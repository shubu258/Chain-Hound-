import { runCombinedCategories, type NlCategoryResult } from './nlAgent.js';
import { noopProgress, type ProgressEmitter } from '../progress.js';

// Chain isn't enforced server-side beyond being substituted into the natural-language prompt —
// it's up to the model (via the tools it's given) to interpret/filter by it.
export type Chain = string;

export interface WalletData {
    walletAddress: string;
    chain: Chain;
    swaps: NlCategoryResult;
    lending: NlCategoryResult;
    nft: NlCategoryResult;
    bridge: NlCategoryResult;
    fullSweep: NlCategoryResult;
}

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function isValidWalletAddress(address: string): boolean {
    return ADDRESS_RE.test(address);
}

function normalizeAddress(address: string): string {
    if (!ADDRESS_RE.test(address)) {
        throw new Error(`Invalid EVM address: ${address}`);
    }
    return address.toLowerCase();
}

/**
 * Runs the combined 5-category Gemini tool-calling session (src/subgraph/nlAgent.ts) for
 * `walletAddress` — one Gemini conversation instead of 5 separate ones, to stay well under
 * free-tier quota limits. See nlPrompts.ts for the full rationale.
 */
export async function getWalletData(
    walletAddress: string,
    chain: Chain,
    onProgress: ProgressEmitter = noopProgress,
): Promise<WalletData> {
    const wallet = normalizeAddress(walletAddress);
    const byCategory = await runCombinedCategories(chain, wallet, onProgress);
    return { walletAddress: wallet, chain, ...byCategory };
}
