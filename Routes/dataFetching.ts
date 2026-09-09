import { Router, type Request, type Response } from 'express';
import { isValidWalletAddress, type Chain } from '../src/subgraph/dataRetrival.js';
import { analyzeWallet } from '../src/wallet/analyzeWallet.js';

const router = Router();

const DEFAULT_CHAIN: Chain = process.env.DEFAULT_CHAIN ?? 'mainnet';

/**
 * Single entry point for the "give me everything for this wallet" flow: takes just a wallet
 * address and delegates to analyzeWallet (src/wallet/analyzeWallet.ts), which combines two
 * architecturally separate data sources, each clearly labeled:
 *  - top-level balances/transfers/swaps/nftOwnerships/lending: Subgraph MCP (protocol-level
 *    enrichment — discovers relevant subgraphs by keyword, no pre-configured contracts needed)
 *  - "fundFlow": The Graph Token API (fast, wallet-indexed, cross-token sent/received history)
 * These are intentionally not merged/blended — see src/tokenApi/walletTransfers.ts.
 */
router.post('/wallet', async (req: Request, res: Response) => {
  const { walletAddress } = req.body ?? {};

  if (typeof walletAddress !== 'string' || !isValidWalletAddress(walletAddress)) {
    res.status(400).json({ error: 'walletAddress must be a valid EVM address (0x + 40 hex chars)' });
    return;
  }

  try {
    const walletResponse = await analyzeWallet(walletAddress, DEFAULT_CHAIN);
    res.json(walletResponse);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch wallet data' });
  }
});

export default router;
