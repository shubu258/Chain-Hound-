import { Router, type Request, type Response } from 'express';
import { getWalletData, isValidWalletAddress, type Chain } from '../src/subgraph/dataRetrival.js';

const router = Router();

const DEFAULT_CHAIN: Chain = process.env.DEFAULT_CHAIN ?? 'mainnet';

/**
 * Single entry point for the "give me everything for this wallet" flow: takes just a wallet
 * address, discovers relevant subgraphs by keyword (no pre-configured contract addresses
 * needed), and fans out to balances/transfers/swaps/nft ownerships.
 */
router.post('/wallet', async (req: Request, res: Response) => {
  const { walletAddress } = req.body ?? {};

  if (typeof walletAddress !== 'string' || !isValidWalletAddress(walletAddress)) {
    res.status(400).json({ error: 'walletAddress must be a valid EVM address (0x + 40 hex chars)' });
    return;
  }

  try {
    const data = await getWalletData(walletAddress, DEFAULT_CHAIN);
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch wallet data' });
  }
});

export default router;
