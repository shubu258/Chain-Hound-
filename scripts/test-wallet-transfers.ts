// Standalone smoke test for the on-chain wallet-transfers pipeline (src/tokenApi/walletTransfers.ts,
// implemented via ethers.js in src/tokenApi/ethersFallback.ts), independent of the /api/wallet
// endpoint.
//
// Usage:
//   ETHERS_RPC_URL=https://your-mainnet-rpc npx tsx scripts/test-wallet-transfers.ts [address] [network]
//
// Defaults to vitalik.eth (0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045) — a wallet with well-known,
// abundant ERC-20 transfer history — on mainnet.

import 'dotenv/config';
import { getWalletTransfers } from '../src/tokenApi/walletTransfers.js';

const address = process.argv[2] ?? '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const network = process.argv[3] ?? 'mainnet';

if (!process.env.ETHERS_RPC_URL && !process.env[`ETHERS_RPC_URL_${network.toUpperCase()}`]) {
  console.error(`ETHERS_RPC_URL (or ETHERS_RPC_URL_${network.toUpperCase()}) is required — see .env.example.`);
  process.exit(1);
}

console.log(`Fetching wallet transfers for ${address} on ${network} via ethers.js...`);
console.log(`(ETHERS_MAX_TRANSFERS=${process.env.ETHERS_MAX_TRANSFERS ?? 5} per direction)`);
const start = Date.now();

const result = await getWalletTransfers(address, network);

console.log(`Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
console.log(`sent: ${result.sent.length}, received: ${result.received.length}, all: ${result.all.length}`);

console.log('Sample transfers:');
for (const t of result.all.slice(0, 5)) {
  console.log(
    `  [${t.direction}] block ${t.blockNumber} ${t.amount} ${t.tokenSymbol} ${t.from} -> ${t.to} (tx ${t.transactionHash})`,
  );
}

if (result.all.length === 0) {
  console.error('FAIL — no transfers found; try a different address.');
  process.exit(1);
}
console.log('PASS — ethers.js returned real wallet transfer data.');
