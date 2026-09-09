import { Router, type Request, type Response } from 'express';
import { isValidWalletAddress } from '../src/subgraph/dataRetrival.js';
import { traceFundFlow } from '../src/trace/traceEngine.js';

const router = Router();

const DEFAULT_TRACE_CHAIN = 'ethereum';

/**
 * POST /api/trace — follows fund flow outward from a starting wallet, hop by hop, using
 * analyzeWallet (src/wallet/analyzeWallet.ts) as the per-hop engine and traceFundFlow
 * (src/trace/traceEngine.ts) for the BFS traversal, sink detection, and hard caps. See
 * traceEngine.ts for why the trace is always guaranteed to terminate.
 */
router.post('/trace', async (req: Request, res: Response) => {
  const { walletAddress, chain, maxDepth, minAmountUSD } = req.body ?? {};

  if (typeof walletAddress !== 'string' || !isValidWalletAddress(walletAddress)) {
    res.status(400).json({ error: 'walletAddress must be a valid EVM address (0x + 40 hex chars)' });
    return;
  }

  try {
    const result = await traceFundFlow(walletAddress, typeof chain === 'string' ? chain : DEFAULT_TRACE_CHAIN, {
      maxDepth: typeof maxDepth === 'number' ? maxDepth : undefined,
      minAmountUSD: typeof minAmountUSD === 'number' ? minAmountUSD : undefined,
    });
    res.json(result);
  } catch (err) {
    // traceFundFlow contains per-hop failures internally (see traceEngine.ts's processHop), so
    // reaching here means something outside a single hop broke (e.g. a programming error) rather
    // than one wallet's analysis failing.
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to trace fund flow' });
  }
});

export default router;
