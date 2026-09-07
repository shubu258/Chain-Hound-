import { Router, type Request, type Response } from 'express';
import { getWalletData, isValidWalletAddress, type Chain } from '../src/subgraph/dataRetrival.js';
import { getWalletTransfers as getTokenApiTransfers } from '../src/tokenApi/walletTransfers.js';

const router = Router();

const DEFAULT_CHAIN: Chain = process.env.DEFAULT_CHAIN ?? 'mainnet';

/**
 * Single entry point for the "give me everything for this wallet" flow: takes just a wallet
 * address and combines two architecturally separate data sources, each clearly labeled:
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

  const [subgraphResult, fundFlowResult] = await Promise.allSettled([
    getWalletData(walletAddress, DEFAULT_CHAIN),
    getTokenApiTransfers(walletAddress, DEFAULT_CHAIN),
  ]);

  if (subgraphResult.status === 'rejected') {
    const err = subgraphResult.reason;
    res.status(502).json({ error: err instanceof Error ? err.message : 'Failed to fetch wallet data' });
    return;
  }

  // Token API is additive: if it fails (e.g. no TOKEN_API_ACCESS_TOKEN configured), still return
  // the Subgraph MCP data rather than failing the whole request, with the error surfaced inline.
  const fundFlow =
    fundFlowResult.status === 'fulfilled'
      ? { source: 'token-api' as const, ...fundFlowResult.value }
      : {
          source: 'token-api' as const,
          error: fundFlowResult.reason instanceof Error ? fundFlowResult.reason.message : 'Failed to fetch fund flow',
          sent: [],
          received: [],
          all: [],
        };

  res.json({ ...subgraphResult.value, fundFlow });
});

export default router;
