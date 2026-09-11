import { runNlCategory, type NlCategoryResult } from './nlAgent.js';
import type { NlCategory } from './nlPrompts.js';
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

const CATEGORIES: NlCategory[] = ['swaps', 'lending', 'nft', 'bridge', 'fullSweep'];

/**
 * Runs all 5 NL_TEMPLATES categories (src/subgraph/nlPrompts.ts) for `walletAddress` through the
 * Gemini tool-calling agent (src/subgraph/nlAgent.ts), one at a time (not in parallel) — each
 * category is its own burst of Gemini calls, and running 5 at once multiplies the chance of
 * tripping a per-minute rate limit on top of the daily quota. One category's failure is contained
 * to that category's result rather than failing the whole call.
 */
export async function getWalletData(
    walletAddress: string,
    chain: Chain,
    onProgress: ProgressEmitter = noopProgress,
): Promise<WalletData> {
    const wallet = normalizeAddress(walletAddress);

    const byCategory = {} as Record<NlCategory, NlCategoryResult>;
    for (const category of CATEGORIES) {
        const step = `subgraph:${category}`;
        onProgress({ step, label: `Checking ${category}`, status: 'start' });
        try {
            const result = await runNlCategory(category, chain, wallet);
            byCategory[category] = result;
            onProgress({ step, label: `Checking ${category}`, status: result.error ? 'error' : 'done', detail: result.error });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            byCategory[category] = { error: message };
            onProgress({ step, label: `Checking ${category}`, status: 'error', detail: message });
        }
    }

    return { walletAddress: wallet, chain, ...byCategory };
}
