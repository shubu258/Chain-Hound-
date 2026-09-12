// Per-category natural-language instructions the NL agent (src/subgraph/nlAgent.ts) sends to the
// model — one instruction, one hardcoded subgraph, one Gemini API key, one MCP tool call, per
// category. This used to be ONE instruction covering 5 categories in a single conversation, asking
// the model to freely search+introspect+query across ~10 named protocols — that's 20-30+ tool
// calls, far past any reasonable round-trip budget, since the MCP server only exposes
// single-purpose primitives (search for a subgraph, look up its schema, run one query) with no
// "give me everything" tool.
//
// Now there are only 2 categories, each fully independent:
//  - swaps: Uniswap V3 Ethereum mainnet (found via get_top_subgraph_deployments against Uniswap
//    V3's factory contract, ranked by query fees — the highest-fee deployment is the canonical one)
//  - lending: Aave V3 Ethereum mainnet (same method, against Aave V3's Pool contract)
// Each runs as its own conversation with its own Gemini API key (see nlAgent.ts's
// CATEGORY_API_KEY_ENV_VAR) — separate free-tier quota buckets, and one category's quota
// exhaustion doesn't affect the other. The model still makes the real MCP tool call and writes the
// natural-language summary (this stays MCP-driven, not a bypassed direct fetch), but it's exactly
// ONE prescribed tool call per category instead of open-ended exploration.
//
// Generic ERC-20 transfer history ("transfers") is intentionally not a category here — it's
// already covered by the on-chain fund-flow pipeline (src/tokenApi/walletTransfers.ts).

export type NlCategory = 'swaps' | 'lending';

export const NL_CATEGORIES: NlCategory[] = ['swaps', 'lending'];

const MAX_EVENTS = 5;

// Uniswap V3 Ethereum mainnet subgraph deployment (IPFS hash), highest query-fee deployment for
// the Uniswap V3 Factory (0x1F98431c8aD98523631AE4a59f267346ea31F984) per get_top_subgraph_deployments.
const UNISWAP_V3_MAINNET_IPFS_HASH = 'QmTZ8ejXJxRo7vDBS4uwqBeGoxLSWbhaA7oXa1RvxunLy7';

const SWAPS_QUERY = `query WalletSwaps($origin: Bytes!) {
  swaps(where: { origin: $origin }, orderBy: timestamp, orderDirection: desc, first: ${MAX_EVENTS}) {
    id
    timestamp
    pool { id token0 { symbol } token1 { symbol } }
    amount0
    amount1
    amountUSD
    transaction { id }
  }
}`;

// Aave V3 Ethereum mainnet subgraph deployment (IPFS hash), highest query-fee deployment for the
// Aave V3 Pool (0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2) per get_top_subgraph_deployments. Uses
// Messari's standardized lending schema (Deposit/Borrow/Repay/Withdraw entities).
const AAVE_V3_MAINNET_IPFS_HASH = 'QmcXE5QVcBcvcaJddPxd8mFs6W9xt7STmwfgguoiM6ddAd';

const LENDING_QUERY = `query WalletLending($account: String!) {
  deposits(where: { account: $account }, orderBy: timestamp, orderDirection: desc, first: ${MAX_EVENTS}) {
    hash timestamp asset { symbol decimals } amount market { name }
  }
  borrows(where: { account: $account }, orderBy: timestamp, orderDirection: desc, first: ${MAX_EVENTS}) {
    hash timestamp asset { symbol decimals } amount market { name }
  }
  repays(where: { account: $account }, orderBy: timestamp, orderDirection: desc, first: ${MAX_EVENTS}) {
    hash timestamp asset { symbol decimals } amount market { name }
  }
  withdraws(where: { account: $account }, orderBy: timestamp, orderDirection: desc, first: ${MAX_EVENTS}) {
    hash timestamp asset { symbol decimals } amount market { name }
  }
}`;

const SWAPS_TEMPLATE = `Fetch wallet {walletAddress}'s recent Uniswap V3 swap activity on Ethereum
mainnet using EXACTLY ONE tool call — no searching, no schema lookup, no other subgraphs.

Call execute_query_by_ipfs_hash with exactly these arguments:
  ipfs_hash: "${UNISWAP_V3_MAINNET_IPFS_HASH}"
  variables: { "origin": "{walletAddress}" }
  query:
${SWAPS_QUERY}

Call that tool exactly once with those exact arguments. Then, for each returned swap, summarize
which token was sold, which was bought, the USD value, the transaction hash, and the timestamp. If
the tool returns zero swaps, that is a valid answer — report an empty list. Do not retry the call
or search for a different subgraph.

Respond with ONLY a single JSON object (no prose, no markdown fences) of exactly this shape:
{
  "results": [ { "pool": "...", "sold": "...", "bought": "...", "amountUSD": "...", "transactionHash": "...", "timestamp": ... } ],
  "sourcesUsed": [ { "subgraphId": "${UNISWAP_V3_MAINNET_IPFS_HASH}", "displayName": "Uniswap V3 (Ethereum mainnet)" } ]
}`;

const LENDING_TEMPLATE = `Fetch wallet {walletAddress}'s recent Aave V3 lending activity on
Ethereum mainnet using EXACTLY ONE tool call — no searching, no schema lookup, no other subgraphs.

Call execute_query_by_ipfs_hash with exactly these arguments:
  ipfs_hash: "${AAVE_V3_MAINNET_IPFS_HASH}"
  variables: { "account": "{walletAddress}" }
  query:
${LENDING_QUERY}

Call that tool exactly once with those exact arguments. It returns up to 4 separate lists
(deposits, borrows, repays, withdraws). Merge all of them, sort by timestamp descending, and keep
only the ${MAX_EVENTS} most recent overall. For each, summarize the event type (deposit/borrow/
repay/withdraw), the token, the human-readable amount (divide by 10^decimals), the market, the
transaction hash, and the timestamp. If all four lists are empty, that is a valid answer — report
an empty list. Do not retry the call or search for a different subgraph.

Respond with ONLY a single JSON object (no prose, no markdown fences) of exactly this shape:
{
  "results": [ { "eventType": "deposit" | "borrow" | "repay" | "withdraw", "token": "...", "amount": "...", "market": "...", "transactionHash": "...", "timestamp": ... } ],
  "sourcesUsed": [ { "subgraphId": "${AAVE_V3_MAINNET_IPFS_HASH}", "displayName": "Aave V3 (Ethereum mainnet)" } ]
}`;

const TEMPLATES: Record<NlCategory, string> = {
  swaps: SWAPS_TEMPLATE,
  lending: LENDING_TEMPLATE,
};

export function fillCategoryTemplate(category: NlCategory, walletAddress: string): string {
  return TEMPLATES[category].replaceAll('{walletAddress}', walletAddress);
}
