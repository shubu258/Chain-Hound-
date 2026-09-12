// Turns the combined output of Routes/dataFetching.ts (5 Subgraph-MCP categories from
// src/subgraph/dataRetrival.ts + the on-chain "fundFlow" block from
// src/tokenApi/walletTransfers.ts) into a structured wallet risk analysis, via a single
// non-tool-calling pass through the same Gemini client used by src/subgraph/nlAgent.ts.
//
// This module does no data fetching of its own — its input is the route's already-assembled
// response object, not a wallet address.

import { getOpenAiClient, DEFAULT_MODEL } from '../subgraph/openaiClient.js';
import { withGeminiRetry } from '../subgraph/geminiRetry.js';
import type { WalletData } from '../subgraph/dataRetrival.js';
import type { WalletTransfersResult } from '../tokenApi/walletTransfers.js';
import { noopProgress, type ProgressEmitter } from '../progress.js';

export type RiskSeverity = 'High' | 'Medium' | 'Low';
export type RiskCategory = 'Fund Flow' | 'Protocol Behavior' | 'Bridge Activity' | 'NFT Behavior' | 'Wallet Identity';
export type RiskLabel = 'Low' | 'Medium' | 'High' | 'Critical';

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

export interface WalletFundFlow extends Partial<WalletTransfersResult> {
  source: 'onchain';
  error?: string;
}

/** Shape of the object Routes/dataFetching.ts sends back for POST /api/wallet. */
export type WalletAnalysisInput = WalletData & { fundFlow: WalletFundFlow };

const SYSTEM_PROMPT = `You are a blockchain wallet risk analyst. You are given the full JSON output of a
wallet investigation, combining two data sources:
- Subgraph MCP sections: "swaps" (Uniswap V3), "lending" (Aave V3) — each an object of shape
  { results?: [...], sourcesUsed?: [...], error?: string, truncated?: true }. An "error" or a missing
  "results" means that section could not be queried, not that the wallet has no activity there.
- "fundFlow": on-chain (ethers.js) cross-token sent/received transfer history for the wallet
  ({ sent: [...], received: [...], all: [...], error?: string }).

Analyze each section in turn — swaps, lending, and fundFlow — looking for
risk-relevant signals (large or rapid fund movements, liquidations, mixer/bridge hopping,
wash-trading-like NFT patterns, brand-new or dormant-then-suddenly-active wallets, etc).

Based on your section-by-section analysis above, combine all signals into:
1. A final risk score (0-100)
2. A risk label: Low / Medium / High / Critical
3. Output your final analysis as structured JSON, not prose. For each risk finding, create a
separate flag object with: severity (High/Medium/Low), category (one of: Fund Flow, Protocol
Behavior, Bridge Activity, NFT Behavior, Wallet Identity), a short title (5-8 words), and a
one-sentence detail explaining exactly what was found with specific numbers/timing where
available.

Also include a "positiveSignals" array for any findings that reduce risk (e.g., long history, no
liquidations, ENS ownership).

If any section had insufficient data to analyze, add an entry to "dataGaps" instead of guessing or
silently omitting it.

Finally, add one "summary" field: a single 1-2 sentence overview naming only the top 2
highest-severity flags driving the score.

Respond with ONLY a single JSON object (no prose, no markdown fences) of exactly this shape:
{
  "riskScore": <integer 0-100>,
  "riskLabel": "Low" | "Medium" | "High" | "Critical",
  "flags": [ { "severity": "High" | "Medium" | "Low", "category": "Fund Flow" | "Protocol Behavior" | "Bridge Activity" | "NFT Behavior" | "Wallet Identity", "title": "...", "detail": "..." } ],
  "positiveSignals": [ "..." ],
  "dataGaps": [ "..." ],
  "summary": "..."
}`;

// Safety cap so a wallet with pathological transfer/event volume doesn't blow the model's context
// window — mirrors the block-range bound in src/tokenApi/ethersFallback.ts. The model is told when
// a list was cut down so it reports the cutoff as a data gap rather than assuming completeness.
const MAX_ITEMS_PER_LIST = 200;

function truncateLists(value: unknown): unknown {
  if (Array.isArray(value)) {
    const truncated = value.length > MAX_ITEMS_PER_LIST;
    const items = (truncated ? value.slice(0, MAX_ITEMS_PER_LIST) : value).map(truncateLists);
    return truncated ? { items, truncated: true, totalCount: value.length } : items;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, truncateLists(v)]));
  }
  return value;
}

const SEVERITIES: RiskSeverity[] = ['High', 'Medium', 'Low'];
const CATEGORIES: RiskCategory[] = ['Fund Flow', 'Protocol Behavior', 'Bridge Activity', 'NFT Behavior', 'Wallet Identity'];
const LABELS: RiskLabel[] = ['Low', 'Medium', 'High', 'Critical'];

function isRiskFlag(value: unknown): value is RiskFlag {
  if (!value || typeof value !== 'object') return false;
  const f = value as Record<string, unknown>;
  return (
    SEVERITIES.includes(f.severity as RiskSeverity) &&
    CATEGORIES.includes(f.category as RiskCategory) &&
    typeof f.title === 'string' &&
    typeof f.detail === 'string'
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

/** Parses and validates the model's response against the RiskAnalysis shape, or returns undefined. */
function parseRiskAnalysis(text: string): RiskAnalysis | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const r = parsed as Record<string, unknown>;

  if (typeof r.riskScore !== 'number' || r.riskScore < 0 || r.riskScore > 100) return undefined;
  if (!LABELS.includes(r.riskLabel as RiskLabel)) return undefined;
  if (!Array.isArray(r.flags) || !r.flags.every(isRiskFlag)) return undefined;
  if (!isStringArray(r.positiveSignals)) return undefined;
  if (!isStringArray(r.dataGaps)) return undefined;
  if (typeof r.summary !== 'string') return undefined;

  return {
    riskScore: r.riskScore,
    riskLabel: r.riskLabel as RiskLabel,
    flags: r.flags as RiskFlag[],
    positiveSignals: r.positiveSignals,
    dataGaps: r.dataGaps,
    summary: r.summary,
  };
}

/**
 * Runs the wallet-risk-analysis agent over the combined wallet-investigation response (the exact
 * object Routes/dataFetching.ts's POST /api/wallet returns) and produces a structured risk score,
 * severity-tagged flags, positive signals, and data gaps.
 */
export async function analyseWalletRisk(
  walletData: WalletAnalysisInput,
  onProgress: ProgressEmitter = noopProgress,
): Promise<RiskAnalysis> {
  const openai = getOpenAiClient();

  const completion = await withGeminiRetry(
    () =>
      openai.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(truncateLists(walletData)) },
        ],
      }),
    (waitMs) =>
      onProgress({
        step: 'risk',
        label: 'Scoring risk',
        status: 'start',
        detail: `Rate limited — retrying in ${Math.round(waitMs / 1000)}s`,
      }),
  );

  const text = completion.choices[0]?.message?.content ?? '';
  const analysis = parseRiskAnalysis(text);
  if (!analysis) {
    throw new Error(`Risk analysis agent did not return valid JSON: ${text.slice(0, 500)}`);
  }
  return analysis;
}
