// The single-wallet "fetch everything + risk-score it" pipeline, extracted out of
// Routes/dataFetching.ts so it can be reused as the per-hop engine for fund tracing
// (src/trace/traceEngine.ts) as well as the original POST /api/wallet route. Behavior is
// unchanged from the inline version that used to live in the route handler.

import { getWalletData, type Chain, type WalletData } from '../subgraph/dataRetrival.js';
import { getWalletTransfers as getTokenApiTransfers } from '../tokenApi/walletTransfers.js';
import {
  analyseWalletRisk,
  type WalletAnalysisInput,
  type WalletFundFlow,
  type RiskAnalysis,
} from '../analyseData/analyseData.js';

export type { Chain };

export type WalletAnalysisResult = WalletData & {
  fundFlow: WalletFundFlow;
  riskAnalysis: RiskAnalysis | { error: string };
};

/**
 * Runs the Subgraph MCP (5 NL categories) and Token API fund-flow fetches in parallel for one
 * wallet, then risk-scores the combined result. Mirrors exactly what POST /api/wallet used to do
 * inline: a rejected Subgraph MCP fetch fails the whole call (thrown, not swallowed), while a
 * failed Token API fetch or risk-analysis call is additive — its error is surfaced inline on the
 * returned object instead of aborting.
 */
export async function analyzeWallet(walletAddress: string, chain: Chain): Promise<WalletAnalysisResult> {
  const [subgraphResult, fundFlowResult] = await Promise.allSettled([
    getWalletData(walletAddress, chain),
    getTokenApiTransfers(walletAddress, chain),
  ]);

  if (subgraphResult.status === 'rejected') {
    const err = subgraphResult.reason;
    throw err instanceof Error ? err : new Error(String(err));
  }

  const fundFlow: WalletFundFlow =
    fundFlowResult.status === 'fulfilled'
      ? { source: 'token-api', ...fundFlowResult.value }
      : {
          source: 'token-api',
          error: fundFlowResult.reason instanceof Error ? fundFlowResult.reason.message : 'Failed to fetch fund flow',
          sent: [],
          received: [],
          all: [],
        };

  const walletResponse: WalletAnalysisInput = { ...subgraphResult.value, fundFlow };

  let riskAnalysis: RiskAnalysis | { error: string };
  try {
    riskAnalysis = await analyseWalletRisk(walletResponse);
  } catch (err) {
    riskAnalysis = { error: err instanceof Error ? err.message : 'Failed to generate risk analysis' };
  }

  return { ...walletResponse, riskAnalysis };
}
