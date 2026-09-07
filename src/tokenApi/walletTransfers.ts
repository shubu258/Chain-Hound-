// Wallet-level fund-flow, built on The Graph's Token API (see src/subgraphApi/tokenApi.ts).
// This is the "complete, fast sent/received history for any wallet" source — the thing no
// single subgraph can give you, since subgraphs are indexed per-contract, not per-wallet.
// Keep this pipeline separate from src/subgraph/dataRetrival.ts (Subgraph MCP): that one stays
// for protocol-level enrichment (swap mechanics, DeFi positions), this one for raw fund flow.

import { getTransfersPage, type TokenApiTransfer } from '../subgraphApi/tokenApi.js';

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

const DEFAULT_PAGE_LIMIT = 100;
// Safety cap so a wallet with pathological transfer volume can't loop forever — 50 pages at the
// default limit is already 5,000 transfers per direction.
const MAX_PAGES = 50;

function mapTransfer(t: TokenApiTransfer, direction: TransferDirection): WalletTransfer {
  return {
    transactionHash: t.transaction_id,
    blockNumber: t.block_num,
    timestamp: t.timestamp,
    tokenSymbol: t.symbol,
    tokenAddress: t.contract,
    amount: t.amount,
    from: t.from,
    to: t.to,
    direction,
  };
}

/** Fetches every page for one direction (from_address or to_address), stopping at a short/empty/repeated page. */
async function fetchAllPages(
  addressParam: 'from_address' | 'to_address',
  address: string,
  network: string,
  limit: number,
): Promise<TokenApiTransfer[]> {
  const all: TokenApiTransfer[] = [];
  let previousFirstId: string | undefined;

  for (let page = 1; page <= MAX_PAGES; page++) {
    const rows = await getTransfersPage({ network, [addressParam]: address, limit, page });
    if (!rows.length) break;
    // Guards against an off-by-one in the API's page indexing looping forever on the same page.
    if (previousFirstId !== undefined && rows[0]?.transaction_id === previousFirstId) break;
    previousFirstId = rows[0]?.transaction_id;

    all.push(...rows);
    if (rows.length < limit) break; // short page — last one
  }

  return all;
}

/**
 * Fetches every sent and received transfer for `walletAddress` (paginating through all results,
 * not just the first page) and returns them both separately and merged with a direction tag.
 */
export async function getWalletTransfers(
  walletAddress: string,
  network = 'mainnet',
  limit = DEFAULT_PAGE_LIMIT,
): Promise<WalletTransfersResult> {
  const wallet = walletAddress.toLowerCase();

  const [sentRaw, receivedRaw] = await Promise.all([
    fetchAllPages('from_address', wallet, network, limit),
    fetchAllPages('to_address', wallet, network, limit),
  ]);

  const sent = sentRaw.map((t) => mapTransfer(t, 'sent'));
  const received = receivedRaw.map((t) => mapTransfer(t, 'received'));

  return { sent, received, all: [...sent, ...received] };
}
