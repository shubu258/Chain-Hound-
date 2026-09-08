// The 5 fixed natural-language instructions the NL agent (src/subgraph/nlAgent.ts) sends to the
// model, one per category. Wording is kept verbatim as given — only {chain}/{walletAddress} are
// substituted — so the model is steered the same way every time, not by a paraphrase of intent.
//
// Generic ERC-20 transfer history ("transfers") is intentionally NOT one of these — it's already
// covered by the Token API fund-flow pipeline (src/tokenApi/walletTransfers.ts), so running it
// again here would be redundant and would burn one more NL-agent call per request.

export type NlCategory = 'swaps' | 'lending' | 'nft' | 'bridge' | 'fullSweep';

export const NL_TEMPLATES: Record<NlCategory, string> = {
  swaps: `On {chain}, find all swap transactions for wallet {walletAddress}
across Uniswap, SushiSwap, and Curve subgraphs. Include the pool address,
token pair, amounts in and out, transaction hash, and timestamp.`,

  lending: `On {chain}, check if wallet {walletAddress} has any deposit, borrow, repay,
or liquidation events on Aave or Compound. Include the reserve token, amount,
event type, and transaction hash.`,

  nft: `On {chain}, find all NFT mint, sale, or transfer events involving wallet
{walletAddress} as buyer or seller, using OpenSea or Blur subgraphs.
Include collection name, token ID, price, and transaction hash.`,

  bridge: `On {chain}, check if wallet {walletAddress} used any bridge protocol
(Hop, Across, or similar) to move funds cross-chain. Include destination chain,
amount, token, and transaction hash.`,

  fullSweep: `On {chain}, search for any subgraph indexing activity related to wallet
{walletAddress}. For each relevant subgraph found, run a query filtered
by this wallet as sender or receiver, and return all matching events
with transaction hash, timestamp, and amount.`,
};

export function fillTemplate(category: NlCategory, chain: string, walletAddress: string): string {
  return NL_TEMPLATES[category].replaceAll('{chain}', chain).replaceAll('{walletAddress}', walletAddress);
}
