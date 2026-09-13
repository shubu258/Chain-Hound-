import { Router, type Request, type Response } from 'express';
import { isValidWalletAddress, getWalletData, type Chain } from '../src/subgraph/dataRetrival.js';
import { analyzeWallet } from '../src/wallet/analyzeWallet.js';
import { traceFundFlow } from '../src/trace/traceEngine.js';

const router = Router();

const DEFAULT_CHAIN: Chain = process.env.DEFAULT_CHAIN ?? 'mainnet';
const DEFAULT_TRACE_CHAIN = 'ethereum';

/**
 * Machine-callable counterparts of POST /api/wallet and POST /api/trace — same underlying
 * engines, but a single blocking JSON response instead of an NDJSON progress stream. The
 * streaming routes exist for the browser's live status console; a platform calling this as a
 * wallet-screening check (or an agent calling it as a tool, e.g. via a Bazantic Gateway/Recipe)
 * just wants one clean response, not a stream to parse.
 *
 * Two verification depths, same shape both times (a riskScore/riskLabel a caller can threshold
 * on themselves — e.g. "reject anything above 40"):
 *  - /agent/wallet: this wallet's own history only.
 *  - /agent/trace: this wallet plus its most recent counterparties, one hop out, rolled into one
 *    trail-level verdict — for callers who want the deeper check before trusting a wallet.
 */

/**
 * Single-wallet verification: risk-scores one wallet from its own transaction history (swaps,
 * lending, on-chain fund flow) — no counterparties followed. The fast, shallow check.
 *
 * Deliberately skips ENS registration (unlike POST /api/wallet, the browser-facing route this
 * mirrors) — registering a subname is a sequential on-chain write and by far the slowest part of
 * the pipeline, and a caller polling this as a risk gate needs a fast verdict, not a pretty name.
 */
router.post('/agent/wallet', async (req: Request, res: Response) => {
  const { walletAddress, chain } = req.body ?? {};

  if (typeof walletAddress !== 'string' || !isValidWalletAddress(walletAddress)) {
    res.status(400).json({ error: 'walletAddress must be a valid EVM address (0x + 40 hex chars)' });
    return;
  }

  try {
    const walletResponse = await analyzeWallet(walletAddress, typeof chain === 'string' ? chain : DEFAULT_CHAIN);
    res.json(walletResponse);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch wallet data' });
  }
});

/**
 * Trail verification: verifies the wallet plus its most recent counterparties one hop out, then
 * rolls every scored node up into one deterministic trail verdict. The deeper, more secure check.
 *
 * Deliberately skips ENS registration (unlike POST /api/trace, the browser-facing route this
 * mirrors) — same reason as /agent/wallet above, except here it matters more: registering the
 * root wallet *and* every counterparty is a sequential one-nonce-at-a-time on-chain write, so it's
 * the single biggest contributor to this route's latency. Nodes come back addressed by wallet,
 * not ENS name.
 */
router.post('/agent/trace', async (req: Request, res: Response) => {
  const { walletAddress, chain, recentTxLimit } = req.body ?? {};

  if (typeof walletAddress !== 'string' || !isValidWalletAddress(walletAddress)) {
    res.status(400).json({ error: 'walletAddress must be a valid EVM address (0x + 40 hex chars)' });
    return;
  }

  try {
    const result = await traceFundFlow(
      walletAddress,
      typeof chain === 'string' ? chain : DEFAULT_TRACE_CHAIN,
      { recentTxLimit: typeof recentTxLimit === 'number' ? recentTxLimit : undefined },
    );
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to trace fund flow' });
  }
});

/**
 * Thin pass-through onto the same Uniswap V3 subgraph lookup used inside POST /api/wallet (see
 * src/subgraph/dataRetrival.ts) — returns just the "swaps" category for a wallet, as its own
 * standalone callable service (the second Bazantic Gateway paired with /agent/trace in one Recipe).
 */
router.post('/agent/uniswap-activity', async (req: Request, res: Response) => {
  const { walletAddress, chain } = req.body ?? {};

  if (typeof walletAddress !== 'string' || !isValidWalletAddress(walletAddress)) {
    res.status(400).json({ error: 'walletAddress must be a valid EVM address (0x + 40 hex chars)' });
    return;
  }

  try {
    const resolvedChain = typeof chain === 'string' ? chain : DEFAULT_CHAIN;
    const data = await getWalletData(walletAddress, resolvedChain);
    res.json({ walletAddress: data.walletAddress, chain: data.chain, swaps: data.swaps });
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch Uniswap activity' });
  }
});

export default router;
