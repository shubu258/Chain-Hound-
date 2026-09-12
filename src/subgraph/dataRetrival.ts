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
 * Runs the 2 prescribed single-query category lookups (src/subgraph/nlAgent.ts) for
 * `walletAddress` — swaps and lending, each its own Gemini conversation with its own API key (own
 * free-tier quota bucket). See nlPrompts.ts for the full rationale.
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
