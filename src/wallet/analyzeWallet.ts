// The single-wallet "fetch everything + risk-score it" pipeline, extracted out of
// Routes/dataFetching.ts so it can be reused as the per-hop engine for fund tracing
// (src/trace/traceEngine.ts) as well as the original POST /api/wallet route. Behavior is
// unchanged from the inline version that used to live in the route handler.

import { getWalletData, type Chain, type WalletData } from '../subgraph/dataRetrival.js';
import { getWalletTransfers as getOnchainTransfers } from '../tokenApi/walletTransfers.js';
import {
  analyseWalletRisk,
  type WalletAnalysisInput,
  type WalletFundFlow,
  type RiskAnalysis,
} from '../analyseData/analyseData.js';
import { noopProgress, type ProgressEmitter } from '../progress.js';

export type { Chain };

export type WalletAnalysisResult = WalletData & {
  fundFlow: WalletFundFlow;
  riskAnalysis: RiskAnalysis | { error: string };
};

/**
 * Runs the Subgraph MCP (swaps + lending) and on-chain (ethers.js) fund-flow fetches in parallel
 * for one wallet, then risk-scores the combined result. Mirrors exactly what POST /api/wallet used
 * to do inline: a rejected Subgraph MCP fetch fails the whole call (thrown, not swallowed), while a
 * failed fund-flow fetch or risk-analysis call is additive — its error is surfaced inline on the
 * returned object instead of aborting.
 */
export async function analyzeWallet(
  walletAddress: string,
  chain: Chain,
  onProgress: ProgressEmitter = noopProgress,
): Promise<WalletAnalysisResult> {
  onProgress({ step: 'fundflow', label: 'Fetching fund flow', status: 'start' });
  const [subgraphResult, fundFlowResult] = await Promise.allSettled([
    getWalletData(walletAddress, chain, onProgress),
    getOnchainTransfers(walletAddress, chain),
  ]);

  if (subgraphResult.status === 'rejected') {
    const err = subgraphResult.reason;
    throw err instanceof Error ? err : new Error(String(err));
  }

  const fundFlow: WalletFundFlow =
    fundFlowResult.status === 'fulfilled'
      ? { source: 'onchain', ...fundFlowResult.value }
      : {
          source: 'onchain',
          error: fundFlowResult.reason instanceof Error ? fundFlowResult.reason.message : 'Failed to fetch fund flow',
          sent: [],
          received: [],
          all: [],
        };
  onProgress({
    step: 'fundflow',
    label: 'Fetching fund flow',
    status: fundFlow.error ? 'error' : 'done',
    detail: fundFlow.error,
  });

  const walletResponse: WalletAnalysisInput = { ...subgraphResult.value, fundFlow };

  onProgress({ step: 'risk', label: 'Scoring risk', status: 'start' });
  let riskAnalysis: RiskAnalysis | { error: string };
  try {
    riskAnalysis = await analyseWalletRisk(walletResponse, onProgress);
    onProgress({ step: 'risk', label: 'Scoring risk', status: 'done' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate risk analysis';
    riskAnalysis = { error: message };
    onProgress({ step: 'risk', label: 'Scoring risk', status: 'error', detail: message });
  }

  return { ...walletResponse, riskAnalysis };
}
