import { Router, type Request, type Response } from 'express';
import { isValidWalletAddress } from '../src/subgraph/dataRetrival.js';
import { traceFundFlow, type TraceNode } from '../src/trace/traceEngine.js';
import { registerWalletNetwork } from '../src/ens/ensRegistrar.js';
import type { ProgressEmitter } from '../src/progress.js';

const router = Router();

const DEFAULT_TRACE_CHAIN = 'ethereum';

/**
 * Registers the root wallet + every neighbor node as real ENSv2 subnames (same registrar used by
 * POST /api/wallet — see src/ens/ensRegistrar.ts), then attaches each wallet's ensName onto its
 * TraceNode. A registration failure is logged and leaves ensName unset on the affected node(s)
 * rather than failing the whole trace — the numbers/graph are still useful without names.
 */
async function attachEnsNames(rootWallet: string, nodes: TraceNode[], onProgress: ProgressEmitter): Promise<TraceNode[]> {
  const neighborWallets = nodes.filter((n) => n.depth === 1).map((n) => n.wallet);

  try {
    const ensNetwork = await registerWalletNetwork(rootWallet, neighborWallets, onProgress);
    const nameByWallet = new Map<string, string>([
      [ensNetwork.root.wallet.toLowerCase(), ensNetwork.root.ensName],
      ...ensNetwork.counterparties.map((c): [string, string] => [c.wallet.toLowerCase(), c.ensName]),
    ]);
    return nodes.map((node) => ({ ...node, ensName: nameByWallet.get(node.wallet.toLowerCase()) }));
  } catch (err) {
    console.warn(`[traceFetching] ENS naming failed: ${err instanceof Error ? err.message : err}`);
    return nodes;
  }
}

/**
 * POST /api/trace — follows fund flow outward from a starting wallet, hop by hop, using
 * analyzeWallet (src/wallet/analyzeWallet.ts) as the per-hop engine and traceFundFlow
 * (src/trace/traceEngine.ts) for the BFS traversal, sink detection, and hard caps. See
 * traceEngine.ts for why the trace is always guaranteed to terminate.
 *
 * Streams newline-delimited JSON, same wire format as POST /api/wallet (see dataFetching.ts):
 * each hop's fund-flow/risk/ENS checkpoints are reported to the client as they happen instead of
 * the whole multi-wallet trace resolving as one silent blocking call.
 */
router.post('/trace', async (req: Request, res: Response) => {
  const { walletAddress, chain, recentTxLimit } = req.body ?? {};

  if (typeof walletAddress !== 'string' || !isValidWalletAddress(walletAddress)) {
    res.status(400).json({ error: 'walletAddress must be a valid EVM address (0x + 40 hex chars)' });
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (line: Record<string, unknown>) => res.write(`${JSON.stringify(line)}\n`);
  const onProgress: ProgressEmitter = (event) => send({ type: 'progress', ...event });

  try {
    const result = await traceFundFlow(
      walletAddress,
      typeof chain === 'string' ? chain : DEFAULT_TRACE_CHAIN,
      { recentTxLimit: typeof recentTxLimit === 'number' ? recentTxLimit : undefined },
      onProgress,
    );
    const nodes = await attachEnsNames(result.rootWallet, result.nodes, onProgress);
    send({ type: 'result', data: { ...result, nodes } });
  } catch (err) {
    // traceFundFlow contains per-hop failures internally (see traceEngine.ts's processHop), so
    // reaching here means something outside a single hop broke (e.g. a programming error) rather
    // than one wallet's analysis failing.
    send({ type: 'fatal', error: err instanceof Error ? err.message : 'Failed to trace fund flow' });
  } finally {
    res.end();
  }
});

export default router;
