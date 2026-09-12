// Implementation behind src/tokenApi/walletTransfers.ts: fetches a wallet's most recent ERC-20
// transfers via Alchemy's `alchemy_getAssetTransfers` JSON-RPC method — sorted newest-first,
// directly, no block scanning needed.
//
// This is Alchemy-specific, not a standard eth_getLogs implementation: plain eth_getLogs requires
// scanning backward in block-range chunks, and free-tier RPC plans cap that range hard (e.g.
// Alchemy's free tier allows only 10 blocks per eth_getLogs call), making a full backward scan
// impractically slow. alchemy_getAssetTransfers sidesteps this entirely via Alchemy's own address
// index. ETHERS_RPC_URL must point at an Alchemy endpoint for this to work.
//
// Keep this pipeline separate from src/subgraph/*.ts (Subgraph MCP) — unrelated data source.

import { JsonRpcProvider, formatUnits } from 'ethers';
import type { TransferDirection, WalletTransfer, WalletTransfersResult } from './walletTransfers.js';

// How many most-recent transfers to fetch per direction (sent/received).
const MAX_TRANSFERS_PER_DIRECTION = Number(process.env.ETHERS_MAX_TRANSFERS ?? 5);

function getRpcUrl(network: string): string {
  const url = process.env[`ETHERS_RPC_URL_${network.toUpperCase()}`] ?? process.env.ETHERS_RPC_URL;
  if (!url) {
    throw new Error(
      `ETHERS_RPC_URL (or ETHERS_RPC_URL_${network.toUpperCase()}) environment variable is required to fetch wallet transfers`,
    );
  }
  return url;
}

const providers = new Map<string, JsonRpcProvider>();
function getProvider(network: string): JsonRpcProvider {
  let provider = providers.get(network);
  if (!provider) {
    provider = new JsonRpcProvider(getRpcUrl(network));
    providers.set(network, provider);
  }
  return provider;
}

interface AlchemyAssetTransfer {
  blockNum: string;
  hash: string;
  from: string;
  to: string | null;
  asset: string | null;
  rawContract: { address: string | null; value: string | null; decimal: string | null };
  metadata?: { blockTimestamp?: string };
}

interface AlchemyAssetTransfersResponse {
  transfers: AlchemyAssetTransfer[];
}

function toWalletTransfer(t: AlchemyAssetTransfer, direction: TransferDirection): WalletTransfer | undefined {
  if (!t.rawContract.address) return undefined; // not an ERC-20 transfer

  const decimals = t.rawContract.decimal ? Number.parseInt(t.rawContract.decimal, 16) : 18;
  const rawValue = t.rawContract.value ? BigInt(t.rawContract.value) : 0n;
  const timestamp = t.metadata?.blockTimestamp ? Math.floor(new Date(t.metadata.blockTimestamp).getTime() / 1000) : 0;

  return {
    transactionHash: t.hash,
    blockNumber: Number.parseInt(t.blockNum, 16),
    timestamp,
    tokenSymbol: t.asset ?? 'UNKNOWN',
    tokenAddress: t.rawContract.address.toLowerCase(),
    amount: formatUnits(rawValue, decimals),
    from: t.from.toLowerCase(),
    to: (t.to ?? '').toLowerCase(),
    direction,
  };
}

async function fetchDirection(
  provider: JsonRpcProvider,
  wallet: string,
  direction: TransferDirection,
): Promise<WalletTransfer[]> {
  const addressParam = direction === 'sent' ? 'fromAddress' : 'toAddress';

  const response = (await provider.send('alchemy_getAssetTransfers', [
    {
      fromBlock: '0x0',
      toBlock: 'latest',
      [addressParam]: wallet,
      category: ['erc20'],
      order: 'desc',
      withMetadata: true,
      excludeZeroValue: true,
      maxCount: `0x${MAX_TRANSFERS_PER_DIRECTION.toString(16)}`,
    },
  ])) as AlchemyAssetTransfersResponse;

  const transfers: WalletTransfer[] = [];
  for (const t of response.transfers) {
    const transfer = toWalletTransfer(t, direction);
    if (transfer) transfers.push(transfer);
  }
  return transfers;
}

/** ethers.js/Alchemy implementation backing getWalletTransfers. */
export async function getWalletTransfersViaEthers(
  walletAddress: string,
  network: string,
): Promise<WalletTransfersResult> {
  const provider = getProvider(network);
  const wallet = walletAddress.toLowerCase();

  const [sent, received] = await Promise.all([
    fetchDirection(provider, wallet, 'sent'),
    fetchDirection(provider, wallet, 'received'),
  ]);

  return { sent, received, all: [...sent, ...received] };
}
