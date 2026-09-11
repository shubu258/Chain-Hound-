// Names every wallet ChainHound encounters as a real ENSv2 subname on Sepolia — the root wallet
// searched, plus every counterparty found in its transaction history — so the frontend can print
// a human/recognizable name next to every raw address instead of just hex.
//
// Naming scheme (see src/ens/labelUtils.ts): the label for a wallet is always its own address
// (lowercased, no 0x), so the SAME wallet gets the SAME leftmost label everywhere it appears,
// whether it's the root of one search or a counterparty in another.
//
// Hierarchy: `<rootLabel>.<parentName>` for the root wallet, `<counterpartyLabel>.<rootLabel>.
// <parentName>` for each counterparty — a real ENSv2 subregistry-of-a-subregistry nesting, not
// just string concatenation. This requires a one-time setup step (scripts/bootstrap-ens-parent.ts)
// that registers `<parentName>` and deploys its subregistry + a shared resolver; see README.
//
// All registrations here are plain permissioned calls into registries WE deployed and control
// (no ETHRegistrar commit-reveal, no payment token) — that flow is only needed once, for the
// parent name itself, in the bootstrap script.

import { keccak256, namehash, toBytes, zeroAddress, type Address } from 'viem';

import { noopProgress, type ProgressEmitter } from '../progress.js';
import { getEnsPublicClient, getEnsWalletClient, getEnsSignerAddress } from './ensClient.js';
import { permissionedRegistryAbi, permissionedRegistryBytecode } from './abi/permissionedRegistryAbi.js';
import { permissionedResolverAbi } from './abi/permissionedResolverAbi.js';
import { ROLES_ALL, MAX_EXPIRY, LABEL_STORE_ADDRESS } from './addresses.js';
import { addressToLabel, buildEnsName } from './labelUtils.js';
import { sepolia } from 'viem/chains';

const REGISTRY_STATUS_AVAILABLE = 0;
const REGISTRY_STATUS_REGISTERED = 2;

/** Safety cap so one wallet with an enormous transfer history can't trigger hundreds of onchain txs. */
export const MAX_COUNTERPARTIES_PER_REQUEST = 25;

export interface NamedWallet {
  wallet: string;
  ensName: string;
}

export interface WalletNetworkResult {
  root: NamedWallet;
  counterparties: NamedWallet[];
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} environment variable is required (run scripts/bootstrap-ens-parent.ts once to obtain it)`,
    );
  }
  return value;
}

function getParentConfig() {
  return {
    parentName: requireEnv('PARENT_ENS_NAME'),
    parentSubregistry: requireEnv('PARENT_SUBREGISTRY_ADDRESS') as Address,
    parentResolver: requireEnv('PARENT_RESOLVER_ADDRESS') as Address,
  };
}

// LibLabel.id(): keccak256 of the raw label string (not the full dotted name), per
// ensdomains/contracts-v2 — this is the tokenId/state key PermissionedRegistry indexes by.
function labelHashId(label: string): bigint {
  return BigInt(keccak256(toBytes(label)));
}

async function getLabelState(registryAddress: Address, label: string) {
  const publicClient = getEnsPublicClient();
  return publicClient.readContract({
    address: registryAddress,
    abi: permissionedRegistryAbi,
    functionName: 'getState',
    args: [labelHashId(label)],
  });
}

async function deployChildRegistry(ownerAddress: Address): Promise<Address> {
  const walletClient = getEnsWalletClient();
  const publicClient = getEnsPublicClient();

  const hash = await walletClient.deployContract({
    abi: permissionedRegistryAbi,
    bytecode: permissionedRegistryBytecode,
    args: [LABEL_STORE_ADDRESS, ownerAddress, ROLES_ALL],
    account: walletClient.account!,
    chain: sepolia,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error(`PermissionedRegistry deployment (tx ${hash}) did not return a contract address`);
  }
  return receipt.contractAddress;
}

async function registerInRegistry(params: {
  registryAddress: Address;
  label: string;
  ownerAddress: Address;
  subregistryAddress: Address;
  resolverAddress: Address;
  roleBitmap: bigint;
}): Promise<void> {
  const walletClient = getEnsWalletClient();
  const publicClient = getEnsPublicClient();

  const hash = await walletClient.writeContract({
    address: params.registryAddress,
    abi: permissionedRegistryAbi,
    functionName: 'register',
    args: [
      params.label,
      params.ownerAddress,
      params.subregistryAddress,
      params.resolverAddress,
      params.roleBitmap,
      MAX_EXPIRY,
    ],
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

async function setAddrRecord(resolverAddress: Address, ensName: string, walletAddress: Address): Promise<void> {
  const walletClient = getEnsWalletClient();
  const publicClient = getEnsPublicClient();
  const node = namehash(ensName);

  const hash = await walletClient.writeContract({
    address: resolverAddress,
    abi: permissionedResolverAbi,
    functionName: 'setAddr',
    args: [node, walletAddress],
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}

/**
 * Ensures the root wallet is registered as `<label>.<parentName>` with its own subregistry
 * (so counterparties can nest under it). Idempotent: if already registered, just returns the
 * existing name + subregistry address instead of re-registering.
 */
export async function registerRootWallet(rootWalletAddress: string): Promise<NamedWallet & { subregistryAddress: Address }> {
  const { parentName, parentSubregistry, parentResolver } = getParentConfig();
  const label = addressToLabel(rootWalletAddress);
  const ensName = buildEnsName(label, parentName);

  const state = await getLabelState(parentSubregistry, label);
  if (state.status === REGISTRY_STATUS_REGISTERED) {
    const publicClient = getEnsPublicClient();
    const subregistryAddress = await publicClient.readContract({
      address: parentSubregistry,
      abi: permissionedRegistryAbi,
      functionName: 'getSubregistry',
      args: [label],
    });
    return { wallet: rootWalletAddress, ensName, subregistryAddress: subregistryAddress as Address };
  }
  if (state.status !== REGISTRY_STATUS_AVAILABLE) {
    throw new Error(`Label "${label}" under ${parentName} is in an unexpected state (${state.status}), cannot register`);
  }

  const signer = getEnsSignerAddress();
  const subregistryAddress = await deployChildRegistry(signer);
  await registerInRegistry({
    registryAddress: parentSubregistry,
    label,
    ownerAddress: signer,
    subregistryAddress,
    resolverAddress: parentResolver,
    roleBitmap: ROLES_ALL,
  });
  await setAddrRecord(parentResolver, ensName, rootWalletAddress as Address);

  return { wallet: rootWalletAddress, ensName, subregistryAddress };
}

/**
 * Ensures one counterparty wallet is registered as a leaf `<label>.<rootEnsName>` inside the
 * root wallet's own subregistry. Idempotent, same as registerRootWallet.
 */
export async function registerCounterpartyWallet(
  rootSubregistryAddress: Address,
  rootEnsName: string,
  counterpartyAddress: string,
): Promise<NamedWallet> {
  const { parentResolver } = getParentConfig();
  const label = addressToLabel(counterpartyAddress);
  const ensName = buildEnsName(label, rootEnsName);

  const state = await getLabelState(rootSubregistryAddress, label);
  if (state.status === REGISTRY_STATUS_REGISTERED) {
    return { wallet: counterpartyAddress, ensName };
  }
  if (state.status !== REGISTRY_STATUS_AVAILABLE) {
    throw new Error(`Label "${label}" under ${rootEnsName} is in an unexpected state (${state.status}), cannot register`);
  }

  const signer = getEnsSignerAddress();
  await registerInRegistry({
    registryAddress: rootSubregistryAddress,
    label,
    ownerAddress: signer,
    subregistryAddress: zeroAddress,
    resolverAddress: parentResolver,
    roleBitmap: 0n,
  });
  await setAddrRecord(parentResolver, ensName, counterpartyAddress as Address);

  return { wallet: counterpartyAddress, ensName };
}

/**
 * Registers the root wallet plus every counterparty address found in its transaction history,
 * as real ENSv2 subnames on Sepolia. Processes counterparties sequentially (one signer, one
 * nonce at a time) and caps the batch at MAX_COUNTERPARTIES_PER_REQUEST; one failing address is
 * logged and skipped rather than aborting the rest.
 */
export async function registerWalletNetwork(
  rootWalletAddress: string,
  counterpartyAddresses: string[],
  onProgress: ProgressEmitter = noopProgress,
): Promise<WalletNetworkResult> {
  const capped = counterpartyAddresses.slice(0, MAX_COUNTERPARTIES_PER_REQUEST);
  if (counterpartyAddresses.length > capped.length) {
    console.warn(
      `[ensRegistrar] ${counterpartyAddresses.length} counterparties found, only naming the first ${capped.length} (MAX_COUNTERPARTIES_PER_REQUEST)`,
    );
  }

  onProgress({ step: 'ens:root', label: 'Registering root wallet ENS name', status: 'start' });
  const root = await registerRootWallet(rootWalletAddress);
  onProgress({ step: 'ens:root', label: 'Registering root wallet ENS name', status: 'done', detail: root.ensName });

  const counterparties: NamedWallet[] = [];
  for (const [i, address] of capped.entries()) {
    const step = `ens:counterparty:${i + 1}/${capped.length}`;
    const label = `Naming counterparty ${i + 1} of ${capped.length}`;
    onProgress({ step, label, status: 'start' });
    try {
      const named = await registerCounterpartyWallet(root.subregistryAddress, root.ensName, address);
      counterparties.push(named);
      onProgress({ step, label, status: 'done', detail: named.ensName });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[ensRegistrar] failed to register counterparty ${address}: ${message}`);
      onProgress({ step, label, status: 'error', detail: message });
    }
  }

  return { root: { wallet: root.wallet, ensName: root.ensName }, counterparties };
}
