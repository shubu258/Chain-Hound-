// Fund-tracing / wallet-verification engine: given a starting wallet, looks at who it most
// recently sent money to, then runs our existing full single-wallet analyzer
// (src/wallet/analyzeWallet.ts) on each of those wallets to verify them. This is intentionally
// scoped for a hackathon demo, not a full multi-hop investigation:
//   - Only the wallet's N most recent outgoing transfers are considered (default 5), not its
//     whole transaction history.
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

export interface TraceFundFlowResult {
  rootWallet: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  stats: TraceStats;
}

export interface TraceFundFlowOptions {
  /** How many of the root wallet's most recent outgoing transfers to follow. Default 5. */
  recentTxLimit?: number;
}

const DEFAULT_RECENT_TX_LIMIT = 5;

// At most this many neighbor-wallet verifications run concurrently. Each one is itself several
// Token API + Gemini calls (see analyzeWallet), so firing all of them at once would risk rate
// limits — but since this trace is capped at ~5 neighbors total, this mostly just keeps things
// polite rather than being load-bearing the way it was for a deep multi-hop search.
const HOP_CONCURRENCY = 3;

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function hasRiskScore(risk: WalletAnalysisResult['riskAnalysis']): risk is RiskAnalysis {
  return typeof (risk as RiskAnalysis).riskScore === 'number';
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
): Promise<TraceFundFlowResult> {
  const recentTxLimit = options.recentTxLimit ?? DEFAULT_RECENT_TX_LIMIT;
  const root = startWallet.toLowerCase();

  // Step 1 — full verification of the root wallet itself.
  const rootResult = await analyzeWallet(root, chain);
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

  // Step 3 — verify each neighbor with the same full pipeline used on the root, then stop
  // (step 4): we deliberately never look at *their* sent transfers.
  const neighborNodes = await mapWithConcurrency(neighbors, HOP_CONCURRENCY, async (wallet): Promise<TraceNode> => {
    try {
      const result = await analyzeWallet(wallet, chain);
      return toTraceNode(wallet, 1, result);
    } catch (err) {
      console.error(`[traceFundFlow] neighbor analysis failed for ${wallet}:`, err);
      return { wallet, depth: 1, isSink: false, topFlags: [], error: true };
    }
  });

  const nodes = [rootNode, ...neighborNodes];

  return {
    rootWallet: root,
    nodes,
    edges,
    stats: {
      totalNodesAnalyzed: nodes.length,
      totalEdgesFound: edges.length,
    },
  };
}
