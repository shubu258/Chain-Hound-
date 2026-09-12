import { Router, type Request, type Response } from 'express';
import { isValidWalletAddress, type Chain } from '../src/subgraph/dataRetrival.js';
import { analyzeWallet } from '../src/wallet/analyzeWallet.js';
import { extractCounterparties } from '../src/ens/counterparties.js';
import { registerWalletNetwork } from '../src/ens/ensRegistrar.js';
import type { ProgressEvent } from '../src/progress.js';

const router = Router();

const DEFAULT_CHAIN: Chain = process.env.DEFAULT_CHAIN ?? 'mainnet';

/**
 * Single entry point for the "give me everything for this wallet" flow: takes just a wallet
 * address and delegates to analyzeWallet (src/wallet/analyzeWallet.ts), which combines two
 * architecturally separate data sources, each clearly labeled:
 *  - top-level "swaps" (Uniswap V3) and "lending" (Aave V3): Subgraph MCP, one prescribed query
 *    each, each on its own Gemini API key (see src/subgraph/nlAgent.ts)
 *  - "fundFlow": on-chain via ethers.js (fast, wallet-indexed, cross-token sent/received history)
 * These are intentionally not merged/blended — see src/tokenApi/walletTransfers.ts.
 *
 * Streams newline-delimited JSON instead of one blocking response: the full pipeline (swaps +
 * lending run in parallel, then risk analysis, then ENS registration per wallet) can take a
 * while, so each step is reported as it happens rather than the client seeing nothing until the
 * very end. Line shapes: {"type":"progress",...ProgressEvent}, {"type":"result","data":{...}}, or
 * {"type":"fatal","error":string}. Because the response has already started streaming by the time
 * a fatal error can occur, that error is a stream line, not an HTTP error status — the HTTP status
 * is only meaningful for the upfront validation check below.
 */
router.post('/wallet', async (req: Request, res: Response) => {
  const { walletAddress } = req.body ?? {};

  if (typeof walletAddress !== 'string' || !isValidWalletAddress(walletAddress)) {
    res.status(400).json({ error: 'walletAddress must be a valid EVM address (0x + 40 hex chars)' });
    return;
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('X-Accel-Buffering', 'no');

  const send = (line: Record<string, unknown>) => res.write(`${JSON.stringify(line)}\n`);
  const onProgress = (event: ProgressEvent) => send({ type: 'progress', ...event });

  try {
    const walletResponse = await analyzeWallet(walletAddress, DEFAULT_CHAIN, onProgress);

    let ensNetwork: Awaited<ReturnType<typeof registerWalletNetwork>> | { error: string };
    try {
      const counterparties = extractCounterparties(walletAddress, walletResponse.fundFlow);
      ensNetwork = await registerWalletNetwork(walletAddress, counterparties, onProgress);
    } catch (err) {
      ensNetwork = { error: err instanceof Error ? err.message : 'Failed to register ENS wallet network' };
    }

    send({ type: 'result', data: { ...walletResponse, ensNetwork } });
  } catch (err) {
    send({ type: 'fatal', error: err instanceof Error ? err.message : 'Failed to fetch wallet data' });
  } finally {
    res.end();
  }
});

export default router;
