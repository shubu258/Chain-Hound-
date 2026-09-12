// Mirrors the JSON shapes returned by the Express API (../../Routes/dataFetching.ts and
// traceFetching.ts). Kept as plain hand-written types here rather than importing from the
// backend package — the two are separate npm packages in this monorepo.

export type RiskSeverity = "High" | "Medium" | "Low";
export type RiskCategory = "Fund Flow" | "Protocol Behavior" | "Bridge Activity" | "NFT Behavior" | "Wallet Identity";
export type RiskLabel = "Low" | "Medium" | "High" | "Critical";

export interface RiskFlag {
  severity: RiskSeverity;
  category: RiskCategory;
  title: string;
  detail: string;
}

export interface RiskAnalysis {
  riskScore: number;
  riskLabel: RiskLabel;
  flags: RiskFlag[];
  positiveSignals: string[];
  dataGaps: string[];
  summary: string;
}

export interface WalletTransfer {
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  from: string;
  to: string;
  direction: "sent" | "received";
}

export interface WalletFundFlow {
  source: "onchain";
  error?: string;
  sent?: WalletTransfer[];
  received?: WalletTransfer[];
  all?: WalletTransfer[];
}

export interface NamedWallet {
  wallet: string;
  ensName: string;
}

export interface WalletNetworkResult {
  root: NamedWallet;
  counterparties: NamedWallet[];
}

export interface WalletAnalysisResponse {
  walletAddress: string;
  chain: string;
  fundFlow: WalletFundFlow;
  riskAnalysis: RiskAnalysis | { error: string };
  ensNetwork: WalletNetworkResult | { error: string };
}

export interface TraceNode {
  wallet: string;
  depth: 0 | 1;
  riskScore?: number;
  riskLabel?: RiskLabel;
  topFlags: RiskFlag[];
  isSink: boolean;
  sinkType?: string;
  error?: true;
  ensName?: string;
}

export interface TraceEdge {
  from: string;
  to: string;
  amount: string;
  token: string;
  txHash: string;
  timestamp: number;
}

export interface TraceOverallRisk {
  score?: number;
  label?: RiskLabel;
  passed: boolean;
  reason: string;
  driverWallet?: string;
  scoredNodes: number;
  totalNodes: number;
}

export interface TraceFundFlowResponse {
  rootWallet: string;
  nodes: TraceNode[];
  edges: TraceEdge[];
  stats: { totalNodesAnalyzed: number; totalEdgesFound: number };
  overallRisk: TraceOverallRisk;
}

export interface ApiError {
  error: string;
}

/** Mirrors src/progress.ts — one line of the /api/wallet NDJSON stream. */
export interface ProgressEvent {
  step: string;
  label: string;
  status: "start" | "done" | "error";
  detail?: string;
}

export function hasRiskScore(risk: RiskAnalysis | { error: string }): risk is RiskAnalysis {
  return typeof (risk as RiskAnalysis).riskScore === "number";
}

export function hasEnsNetwork(network: WalletNetworkResult | { error: string }): network is WalletNetworkResult {
  return Array.isArray((network as WalletNetworkResult).counterparties);
}
