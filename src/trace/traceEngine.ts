// Fund-tracing / wallet-verification engine: given a starting wallet, looks at who it most
// recently sent money to, then runs our existing full single-wallet analyzer
// (src/wallet/analyzeWallet.ts) on each of those wallets to verify them. This is intentionally
// scoped for a hackathon demo, not a full multi-hop investigation:
//   - Only the wallet's N most recent outgoing transfers are considered (default 2, kept small —
//     each neighbor re-runs the full analysis pipeline, including Gemini calls, so a low default
//     matters for free-tier quota), not its whole transaction history.
//   - We go exactly ONE hop deep: root -> its recent counterparties. We do NOT recurse into
//     those counterparties' own transfers. That keeps the trace fast, cheap, and always bounded
//     by construction (at most 1 + N wallets get analyzed, full stop) rather than needing
//     maxDepth/maxNodes caps to rein in an open-ended search.
//
// Output is two flat arrays (nodes + edges) — the shape a graph visualization library (React
// Flow, D3, etc.) wants on the frontend later.

import { analyzeWallet, type WalletAnalysisResult, type Chain } from '../wallet/analyzeWallet.js';
import { isKnownSink } from './sinkDetection.js';
import type { RiskAnalysis, RiskFlag } from '../analyseData/analyseData.js';
import { noopProgress, type ProgressEmitter } from '../progress.js';

export interface TraceNode {
  wallet: string;
  depth: 0 | 1;
  riskScore?: number;
  riskLabel?: RiskAnalysis['riskLabel'];
  topFlags: RiskFlag[];
  /** Informational only here (see module comment) — depth is fixed to 1 hop regardless of this. */
  isSink: boolean;
  sinkType?: string;
  /** Set when analyzeWallet itself failed for this wallet (e.g. Subgraph MCP was unreachable) —
   *  the node is still recorded rather than aborting the whole trace. */
  error?: true;
  /** Populated by Routes/traceFetching.ts after traceFundFlow returns, not by this module — ENS
   *  registration is a route-layer side effect, same as it is for POST /api/wallet. Absent if ENS
   *  naming failed for this wallet. */
  ensName?: string;
}

export interface TraceEdge {
  from: string;
  to: string;
  amount: string;
  token: string;
  txHash: string;
  timestamp: number;
}

export interface TraceStats {
  totalNodesAnalyzed: number;
  totalEdgesFound: number;
}

/**
 * The trail's overall verdict — deterministic, not a separate AI call: it's just "the trail is as
 * clean as its riskiest link", taking the highest-severity node's own already-computed riskScore/
 * riskLabel (root or any 1-hop neighbor) rather than asking a model to re-judge the combination.
 * `passed` is a simple convenience flag (Low/Medium -> true, High/Critical -> false, and false —
 * fail closed — if nothing could be scored at all).
 */
export interface TraceOverallRisk {
  score?: number;
  label?: RiskAnalysis['riskLabel'];
  passed: boolean;
  reason: string;
  driverWallet?: string;
  scoredNodes: number;
  totalNodes: number;
}

export interface TraceFundFlowResult {
  rootWallet: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  stats: TraceStats;
  overallRisk: TraceOverallRisk;
}

export interface TraceFundFlowOptions {
  /** How many of the root wallet's most recent outgoing transfers to follow. Default 2. */
  recentTxLimit?: number;
}

const DEFAULT_RECENT_TX_LIMIT = 2;

// At most this many neighbor-wallet verifications run concurrently. Each one is itself several
// on-chain (ethers.js) + Gemini calls (see analyzeWallet), so firing all of them at once would risk
// rate limits — but since this trace is capped at ~2 neighbors total by default, this mostly just
// keeps things polite rather than being load-bearing the way it was for a deep multi-hop search.
const HOP_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * Namespaces a wallet's own progress events (analyzeWallet always reports fixed step keys like
 * "fundflow"/"risk") under a per-hop prefix, so tracing several wallets through the same
 * onProgress emitter doesn't collide different wallets' events onto the same step id — each hop's
 * fund-flow, risk, and subgraph steps show up as their own live lines instead of overwriting a
 * shared "fundflow"/"risk" line every hop reuses.
 */
function scopedProgress(onProgress: ProgressEmitter, prefix: string, walletLabel: string): ProgressEmitter {
  return (event) => onProgress({ ...event, step: `${prefix}:${event.step}`, label: `${walletLabel} · ${event.label}` });
}

function hasRiskScore(risk: WalletAnalysisResult['riskAnalysis']): risk is RiskAnalysis {
  return typeof (risk as RiskAnalysis).riskScore === 'number';
}

const LABEL_SEVERITY: Record<RiskAnalysis['riskLabel'], number> = { Low: 0, Medium: 1, High: 2, Critical: 3 };

/**
 * Deterministically rolls every scored node's own riskScore/riskLabel up into one trail-level
 * verdict — the highest-severity node wins (ties broken by score), since a fund trail is only as
 * clean as its riskiest link. Nodes analyzeWallet couldn't score (error, or Subgraph MCP/Gemini
 * failure) are excluded from the comparison but counted in scoredNodes/totalNodes so the caller
 * can see how much of the trail this verdict is actually based on.
 */
function computeOverallRisk(nodes: TraceNode[]): TraceOverallRisk {
  const scored = nodes.filter(
    (n): n is TraceNode & { riskScore: number; riskLabel: RiskAnalysis['riskLabel'] } =>
      typeof n.riskScore === 'number' && n.riskLabel !== undefined,
  );

  if (scored.length === 0) {
    return {
      passed: false,
      reason: 'No wallet in this trail could be risk-scored',
      scoredNodes: 0,
      totalNodes: nodes.length,
    };
  }

  const worst = scored.reduce((a, b) => {
    const severityDiff = LABEL_SEVERITY[b.riskLabel] - LABEL_SEVERITY[a.riskLabel];
    if (severityDiff !== 0) return severityDiff > 0 ? b : a;
    return b.riskScore > a.riskScore ? b : a;
  });

  const passed = LABEL_SEVERITY[worst.riskLabel] <= LABEL_SEVERITY.Medium;
  const who = worst.depth === 0 ? 'the root wallet' : `a wallet 1 hop out (${worst.wallet})`;

  return {
    score: worst.riskScore,
    label: worst.riskLabel,
    passed,
    reason: `Highest risk in this trail comes from ${who}: ${worst.riskLabel} (${worst.riskScore}/100)`,
    driverWallet: worst.wallet,
    scoredNodes: scored.length,
    totalNodes: nodes.length,
  };
}

/** Builds a TraceNode from an already-computed analyzeWallet result. isSink is informational only. */
function toTraceNode(wallet: string, depth: 0 | 1, result: WalletAnalysisResult): TraceNode {
  const risk = result.riskAnalysis;
  const riskIsScored = hasRiskScore(risk);
  const sent = result.fundFlow.sent ?? [];

  const known = isKnownSink(wallet);
  const isDeadEnd = sent.length === 0;

  return {
    wallet,
    depth,
    riskScore: riskIsScored ? risk.riskScore : undefined,
    riskLabel: riskIsScored ? risk.riskLabel : undefined,
    topFlags: riskIsScored ? risk.flags.slice(0, 2) : [],
    isSink: known.isSink || isDeadEnd,
    sinkType: known.isSink ? known.sinkType : isDeadEnd ? 'dead_end' : undefined,
  };
}

/**
 * Traces fund flow one hop out from `startWallet`:
 *  1. Fully analyze the root wallet (reuses the existing single-wallet pipeline).
 *  2. From the root's already-fetched sent transfers, take the `recentTxLimit` most recent ones
 *     — this is the "only look at the last few transactions" scoping, not a full history walk.
 *  3. Fully analyze each distinct counterparty wallet from those transfers (verification), with
 *     limited concurrency.
 *  4. Stop. Their transfers are never fetched or followed — this is a 1-hop check, not a
 *     multi-hop chase.
 */
export async function traceFundFlow(
  startWallet: string,
  chain: Chain,
  options: TraceFundFlowOptions = {},
  onProgress: ProgressEmitter = noopProgress,
): Promise<TraceFundFlowResult> {
  const recentTxLimit = options.recentTxLimit ?? DEFAULT_RECENT_TX_LIMIT;
  const root = startWallet.toLowerCase();

  // Step 1 — full verification of the root wallet itself. Numbered "Wallet 1" (rather than
  // "root") so the live console reads as one loop — Wallet 1 done, Wallet 2 done, ... — across
  // both the root and its neighbors, since from the console's point of view they run the same
  // per-wallet pipeline one after another.
  const rootLabel = `Wallet 1 (${shortAddress(root)})`;
  onProgress({ step: 'trace:wallet1', label: `Verifying ${rootLabel}`, status: 'start' });
  const rootResult = await analyzeWallet(root, chain, scopedProgress(onProgress, 'wallet1', rootLabel));
  onProgress({ step: 'trace:wallet1', label: `Verifying ${rootLabel}`, status: 'done' });
  const rootNode = toTraceNode(root, 0, rootResult);

  // Step 2 — only the N most recent outgoing transfers decide who gets traced next, not the
  // wallet's entire sent history.
  const recentSent = [...(rootResult.fundFlow.sent ?? [])]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, recentTxLimit);

  const edges: TraceEdge[] = recentSent.map((t) => ({
    from: root,
    to: t.to.toLowerCase(),
    amount: t.amount,
    token: t.tokenSymbol,
    txHash: t.transactionHash,
    timestamp: t.timestamp,
  }));

  const neighbors = [...new Set(edges.map((e) => e.to))].filter((wallet) => wallet !== root);
  onProgress({
    step: 'trace:neighbors',
    label: `Found ${neighbors.length} counterpart${neighbors.length === 1 ? 'y' : 'ies'} to verify`,
    status: 'done',
  });

  // Step 3 — verify each neighbor with the same full pipeline used on the root, then stop
  // (step 4): we deliberately never look at *their* sent transfers. Continues the "Wallet N"
  // numbering from the root (Wallet 1), so neighbor 1 is Wallet 2, neighbor 2 is Wallet 3, etc.
  const neighborNodes = await mapWithConcurrency(neighbors, HOP_CONCURRENCY, async (wallet, i): Promise<TraceNode> => {
    const walletNum = i + 2;
    const label = `Wallet ${walletNum} (${shortAddress(wallet)})`;
    const step = `trace:wallet${walletNum}`;
    onProgress({ step, label: `Verifying ${label}`, status: 'start' });
    try {
      const result = await analyzeWallet(wallet, chain, scopedProgress(onProgress, `wallet${walletNum}`, label));
      onProgress({ step, label: `Verifying ${label}`, status: 'done' });
      return toTraceNode(wallet, 1, result);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[traceFundFlow] neighbor analysis failed for ${wallet}:`, err);
      onProgress({ step, label: `Verifying ${label}`, status: 'error', detail: message });
      return { wallet, depth: 1, isSink: false, topFlags: [], error: true };
    }
  });

  const nodes = [rootNode, ...neighborNodes];
  const overallRisk = computeOverallRisk(nodes);
  onProgress({ step: 'trace:verdict', label: `Trail verdict: ${overallRisk.label ?? 'unscored'}`, status: 'done' });

  return {
    rootWallet: root,
    nodes,
    edges,
    stats: {
      totalNodesAnalyzed: nodes.length,
      totalEdgesFound: edges.length,
    },
    overallRisk,
  };
}
