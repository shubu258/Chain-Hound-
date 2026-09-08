import { runNlCategory, type NlCategoryResult } from './nlAgent.js';
import type { NlCategory } from './nlPrompts.js';

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
 * Gemini tool-calling agent (src/subgraph/nlAgent.ts), in parallel. One category's failure is
 * contained to that category's result rather than failing the whole call.
 */
export async function getWalletData(walletAddress: string, chain: Chain): Promise<WalletData> {
    const wallet = normalizeAddress(walletAddress);

    const settled = await Promise.allSettled(CATEGORIES.map((category) => runNlCategory(category, chain, wallet)));

    const byCategory = Object.fromEntries(
        CATEGORIES.map((category, i) => {
            const outcome = settled[i];
            const result: NlCategoryResult =
                outcome.status === 'fulfilled'
                    ? outcome.value
                    : { error: outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason) };
            return [category, result];
        }),
    ) as Record<NlCategory, NlCategoryResult>;

    return { walletAddress: wallet, chain, ...byCategory };
}
