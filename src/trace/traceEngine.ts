// Fund-tracing engine: walks outward from a starting wallet, hop by hop, reusing our existing
// single-wallet analyzer (src/wallet/analyzeWallet.ts) as the "what happened at this wallet"
// engine at every hop. This module adds the graph-traversal layer on top of it: BFS, cycle
// prevention, sink detection, and hard caps so a trace always terminates.
//
// Output is two flat arrays (nodes + edges), not a nested tree — that's the shape graph
// visualization libraries (React Flow, D3, etc.) want on the frontend later.

import { analyzeWallet, type WalletAnalysisResult, type Chain } from '../wallet/analyzeWallet.js';
import { isKnownSink } from './sinkDetection.js';
import type { RiskAnalysis, RiskFlag } from '../analyseData/analyseData.js';
import type { WalletTransfer } from '../tokenApi/walletTransfers.js';

export interface TraceNode {
  wallet: string;
  depth: number;
  riskScore?: number;
  riskLabel?: RiskAnalysis['riskLabel'];
  topFlags: RiskFlag[];
  isSink: boolean;
  sinkType?: string;
  /** Set when analyzeWallet itself failed for this wallet (e.g. Subgraph MCP was unreachable) — the
   *  hop is recorded but not expanded, rather than aborting the whole trace. */
  error?: true;
}

export interface TraceEdge {
  from: string;
  to: string;
  amount: string;
  /** Best-effort USD estimate — see estimateAmountUSD below. Undefined when we can't price the token. */
  amountUSD?: number;
  token: string;
  txHash: string;
  timestamp: number;
}

export interface TraceStats {
  totalNodesAnalyzed: number;
  totalEdgesFound: number;
  maxDepthReached: number;
}

export interface TraceFundFlowResult {
  rootWallet: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  /** True if maxDepth or maxNodes cut the trace short of natural completion. */
  truncated: boolean;
  stats: TraceStats;
}

export interface TraceFundFlowOptions {
  maxDepth?: number;
  minAmountUSD?: number;
  maxNodes?: number;
}

const DEFAULT_MAX_DEPTH = 6;
const DEFAULT_MIN_AMOUNT_USD = 100;
const DEFAULT_MAX_NODES = 50;

// At most this many hop-analyses run concurrently. Each hop analysis is itself several Token API
// + Gemini calls (see analyzeWallet), so letting a wide BFS frontier fire unbounded parallel
// requests would blow through rate limits (and cost) fast.
const HOP_CONCURRENCY = 3;

// Stablecoins we treat as ~$1 per unit for the USD estimate below.
const STABLECOINS = new Set(['USDC', 'USDT', 'DAI', 'BUSD', 'TUSD', 'USDP', 'FRAX']);
// Decimals for the handful of tokens we know how to price at all. Anything else falls back to
// "unknown" rather than guessing.
const KNOWN_DECIMALS: Record<string, number> = {
  USDC: 6,
  USDT: 6,
  DAI: 18,
  BUSD: 18,
  TUSD: 18,
  USDP: 18,
  FRAX: 18,
};

/**
 * LIMITATION: ChainHound has no live price feed wired up yet, so this is a heuristic stand-in for
 * a real amountUSD field, not a real one. Stablecoins are treated as ~$1 (their decimal-adjusted
 * quantity IS the USD estimate); every other token (ETH, WBTC, arbitrary ERC-20s, ...) falls back
 * to `undefined`. A transfer with an unknown USD value is NOT pruned by minAmountUSD below — we'd
 * rather over-include an edge than silently drop real fund movement because we can't price it.
 * Replace this with a real price oracle before relying on it for anything beyond a demo threshold.
 */
function estimateAmountUSD(transfer: WalletTransfer): number | undefined {
  const symbol = transfer.tokenSymbol?.toUpperCase();
  if (!symbol || !STABLECOINS.has(symbol)) return undefined;

  const decimals = KNOWN_DECIMALS[symbol];
  const raw = Number(transfer.amount);
  if (decimals === undefined || !Number.isFinite(raw)) return undefined;

  const decimalAdjusted = raw / 10 ** decimals;
  return Number.isFinite(decimalAdjusted) ? decimalAdjusted : undefined;
}

/**
 * Runs `items` through `fn` with at most `limit` calls in flight at once. Each worker grabs the
 * next index synchronously (no `await` in between), so there's no race on `next` despite multiple
 * workers running concurrently.
 */
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

interface QueueItem {
  wallet: string;
  depth: number;
}

function hasRiskScore(risk: WalletAnalysisResult['riskAnalysis']): risk is RiskAnalysis {
  return typeof (risk as RiskAnalysis).riskScore === 'number';
}

/**
 * Traces fund flow outward from `startWallet` using breadth-first search: level 0 is the start
 * wallet, level 1 is everyone it sent qualifying transfers to, level 2 is everyone *they* sent to,
 * and so on. A `visited` set (lowercased addresses) prevents cycles and re-analyzing the same
 * wallet twice if two branches converge on it.
 *
 * Each level ("frontier") is analyzed with at most HOP_CONCURRENCY wallets in flight at once, then
 * the next frontier is built from the qualifying outgoing transfers of everything just analyzed.
 * The trace always terminates: expansion stops at a sink (known exchange, or a wallet with no
 * outgoing transfers), at maxDepth, or once maxNodes wallets have been analyzed — whichever comes
 * first, regardless of how much further the data would otherwise go.
 */
export async function traceFundFlow(
  startWallet: string,
  chain: Chain,
  options: TraceFundFlowOptions = {},
): Promise<TraceFundFlowResult> {
  const maxDepth = options.maxDepth ?? DEFAULT_MAX_DEPTH;
  const minAmountUSD = options.minAmountUSD ?? DEFAULT_MIN_AMOUNT_USD;
  const maxNodes = options.maxNodes ?? DEFAULT_MAX_NODES;

  const root = startWallet.toLowerCase();
  const visited = new Set<string>([root]);
  const nodes: TraceNode[] = [];
  const edges: TraceEdge[] = [];
  let truncated = false;
  let maxDepthReached = 0;

  /** Analyzes one wallet, records its node + outgoing edges, and returns the wallets to visit next. */
  async function processHop(wallet: string, depth: number): Promise<QueueItem[]> {
    let result: WalletAnalysisResult;
    try {
      result = await analyzeWallet(wallet, chain);
    } catch (err) {
      console.error(`[traceFundFlow] hop analysis failed for ${wallet} at depth ${depth}:`, err);
      nodes.push({ wallet, depth, isSink: false, topFlags: [], error: true });
      return [];
    }

    const risk = result.riskAnalysis;
    const riskIsScored = hasRiskScore(risk);
    const sent = result.fundFlow.sent ?? [];

    // A wallet is a sink for one of two reasons: it's known exchange infrastructure
    // (sinkDetection.ts) where following further means tracing the exchange's own housekeeping,
    // not the money trail; or it has no outgoing transfers at all — a natural dead end. Either
    // way, we record the node but do not expand past it.
    const known = isKnownSink(wallet);
    const isDeadEnd = sent.length === 0;
    const isSink = known.isSink || isDeadEnd;
    const sinkType = known.isSink ? known.sinkType : isDeadEnd ? 'dead_end' : undefined;

    nodes.push({
      wallet,
      depth,
      riskScore: riskIsScored ? risk.riskScore : undefined,
      riskLabel: riskIsScored ? risk.riskLabel : undefined,
      topFlags: riskIsScored ? risk.flags.slice(0, 2) : [],
      isSink,
      sinkType,
    });

    if (isSink) return [];

    if (depth >= maxDepth) {
      if (sent.length > 0) truncated = true; // there was more to follow; maxDepth cut it off
      return [];
    }

    const next: QueueItem[] = [];
    for (const transfer of sent) {
      const amountUSD = estimateAmountUSD(transfer);
      if (amountUSD !== undefined && amountUSD < minAmountUSD) continue; // below threshold, prune

      edges.push({
        from: wallet,
        to: transfer.to,
        amount: transfer.amount,
        amountUSD,
        token: transfer.tokenSymbol,
        txHash: transfer.transactionHash,
        timestamp: transfer.timestamp,
      });

      const to = transfer.to.toLowerCase();
      if (visited.has(to)) continue;
      if (nodes.length + next.length >= maxNodes) {
        truncated = true;
        continue;
      }
      visited.add(to);
      next.push({ wallet: to, depth: depth + 1 });
    }
    return next;
  }

  let frontier: QueueItem[] = [{ wallet: root, depth: 0 }];

  while (frontier.length > 0 && nodes.length < maxNodes) {
    maxDepthReached = frontier[0].depth;

    // Hard cap on nodes: never analyze more wallets this level than the remaining budget allows.
    const budget = maxNodes - nodes.length;
    const toProcess = frontier.slice(0, budget);
    if (toProcess.length < frontier.length) truncated = true;

    const nextBatches = await mapWithConcurrency(toProcess, HOP_CONCURRENCY, ({ wallet, depth }) =>
      processHop(wallet, depth),
    );
    frontier = nextBatches.flat();
  }

  // Loop exited with wallets still queued — only possible because maxNodes was hit.
  if (frontier.length > 0) truncated = true;

  return {
    rootWallet: root,
    nodes,
    edges,
    truncated,
    stats: {
      totalNodesAnalyzed: nodes.length,
      totalEdgesFound: edges.length,
      maxDepthReached,
    },
  };
}
