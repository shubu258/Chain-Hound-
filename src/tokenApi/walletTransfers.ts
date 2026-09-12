// Wallet-level fund-flow: the most recent sent/received ERC-20 transfers for a wallet, fetched
// directly via Alchemy's alchemy_getAssetTransfers (see src/tokenApi/ethersFallback.ts) — no
// block-range scanning, sorted newest-first. This is the "fast recent history for any wallet"
// source — the thing no single subgraph can give you, since subgraphs are indexed per-contract,
// not per-wallet.
// Keep this pipeline separate from src/subgraph/dataRetrival.ts (Subgraph MCP): that one stays
// for protocol-level enrichment (swap mechanics, DeFi positions), this one for raw fund flow.

import { getWalletTransfersViaEthers } from './ethersFallback.js';

export type TransferDirection = 'sent' | 'received';

export interface WalletTransfer {
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  tokenSymbol: string;
  tokenAddress: string;
  amount: string;
  from: string;
  to: string;
  direction: TransferDirection;
}

export interface WalletTransfersResult {
  sent: WalletTransfer[];
  received: WalletTransfer[];
  /** `sent` and `received` merged into one list, each row tagged with its `direction`. */
  all: WalletTransfer[];
}

/** Fetches the most recent sent and received ERC-20 transfers for `walletAddress` (see
 * ETHERS_MAX_TRANSFERS) and returns them both separately and merged with a direction tag. */
export function getWalletTransfers(walletAddress: string, network = 'mainnet'): Promise<WalletTransfersResult> {
  return getWalletTransfersViaEthers(walletAddress, network);
}
