// Lazy viem clients for talking to real, already-deployed ENSv2 contracts on Sepolia. Follows the
// same "required env var, thrown descriptive Error, memoized getter" pattern as
// src/tokenApi/client.ts's getAccessToken() and src/subgraph/openaiClient.ts's getOpenAiClient().

import { createPublicClient, createWalletClient, http, type Address, type PublicClient, type WalletClient } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';

function getRpcUrl(): string {
  const url = process.env.SEPOLIA_RPC_URL;
  if (!url) {
    throw new Error('SEPOLIA_RPC_URL environment variable is required to talk to ENSv2 on Sepolia');
  }
  return url;
}

function getPrivateKey(): `0x${string}` {
  const key = process.env.ENS_PRIVATE_KEY;
  if (!key) {
    throw new Error('ENS_PRIVATE_KEY environment variable is required to sign ENS registration transactions');
  }
  return (key.startsWith('0x') ? key : `0x${key}`) as `0x${string}`;
}

let publicClient: PublicClient | undefined;
export function getEnsPublicClient(): PublicClient {
  if (!publicClient) {
    publicClient = createPublicClient({ chain: sepolia, transport: http(getRpcUrl()) });
  }
  return publicClient;
}

let walletClient: WalletClient | undefined;
export function getEnsWalletClient(): WalletClient {
  if (!walletClient) {
    walletClient = createWalletClient({
      account: privateKeyToAccount(getPrivateKey()),
      chain: sepolia,
      transport: http(getRpcUrl()),
    });
  }
  return walletClient;
}

export function getEnsSignerAddress(): Address {
  const client = getEnsWalletClient();
  if (!client.account) {
    throw new Error('ENS wallet client has no account configured');
  }
  return client.account.address;
}
