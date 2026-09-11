// The single combined natural-language instruction the NL agent (src/subgraph/nlAgent.ts) sends
// to the model, covering all 5 categories in ONE tool-calling session instead of 5 separate ones.
// Each separate session used to be its own burst of Gemini calls (up to MAX_TOOL_ROUNDTRIPS each);
// running 5 of them per wallet search was exhausting free-tier daily quotas in a single search.
// Combining them costs some per-category precision (the model is juggling 5 asks at once instead
// of focusing on 1) but cuts total Gemini calls roughly 5x.
//
// Generic ERC-20 transfer history ("transfers") is intentionally NOT one of these categories —
// it's already covered by the Token API fund-flow pipeline (src/tokenApi/walletTransfers.ts), so
// asking for it here too would be redundant.

export type NlCategory = 'swaps' | 'lending' | 'nft' | 'bridge' | 'fullSweep';

export const NL_CATEGORIES: NlCategory[] = ['swaps', 'lending', 'nft', 'bridge', 'fullSweep'];

const COMBINED_TEMPLATE = `On {chain}, investigate wallet {walletAddress} using the available
Subgraph tools, covering all five of the following categories in this one pass:

1. swaps — all swap transactions across Uniswap, SushiSwap, and Curve subgraphs. Include the pool
address, token pair, amounts in and out, transaction hash, and timestamp.
2. lending — any deposit, borrow, repay, or liquidation events on Aave or Compound. Include the
reserve token, amount, event type, and transaction hash.
3. nft — all NFT mint, sale, or transfer events involving this wallet as buyer or seller, using
OpenSea or Blur subgraphs. Include collection name, token ID, price, and transaction hash.
4. bridge — any use of a bridge protocol (Hop, Across, or similar) to move funds cross-chain.
Include destination chain, amount, token, and transaction hash.
5. fullSweep — any other subgraph-indexed activity for this wallet (as sender or receiver) not
already covered by 1-4. Include transaction hash, timestamp, and amount.

Investigate efficiently: a single subgraph search or schema introspection may apply to more than
one category above — reuse it instead of repeating the same discovery step per category.

When you are done, respond with ONLY a single JSON object (no prose, no markdown fences) of
exactly this shape:
{
  "swaps": { "results": [ ... ], "sourcesUsed": [ { "subgraphId": "...", "displayName": "..." } ] },
  "lending": { "results": [ ... ], "sourcesUsed": [ ... ] },
  "nft": { "results": [ ... ], "sourcesUsed": [ ... ] },
  "bridge": { "results": [ ... ], "sourcesUsed": [ ... ] },
  "fullSweep": { "results": [ ... ], "sourcesUsed": [ ... ] }
}
Every one of the 5 keys must be present. A category with nothing found still needs its key present
with "results": [].`;

export function fillCombinedTemplate(chain: string, walletAddress: string): string {
  return COMBINED_TEMPLATE.replaceAll('{chain}', chain).replaceAll('{walletAddress}', walletAddress);
}
