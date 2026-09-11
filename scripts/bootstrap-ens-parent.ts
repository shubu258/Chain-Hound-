// ONE-TIME setup: registers the ChainHound parent .eth name on Sepolia (if not already owned),
// deploys its subregistry (holds root-wallet-level names) and a shared resolver (holds every
// setAddr record we write, for both root wallets and counterparties), then prints the three env
// values src/ens/ensRegistrar.ts needs at runtime: PARENT_ENS_NAME, PARENT_SUBREGISTRY_ADDRESS,
// PARENT_RESOLVER_ADDRESS.
//
// Run once: PARENT_ENS_LABEL=chainhound npm run setup:ens
// Requires: SEPOLIA_RPC_URL, ENS_PRIVATE_KEY (funded with a little Sepolia ETH for gas).
// The registration fee itself is paid in a free-mint Sepolia test token (MockUSDC), minted by
// this script — no real money involved.

import 'dotenv/config';
import { encodeFunctionData, keccak256, namehash, toBytes, zeroAddress, type Address, type Hex } from 'viem';
import { randomBytes } from 'node:crypto';

import { getEnsPublicClient, getEnsWalletClient, getEnsSignerAddress } from '../src/ens/ensClient.js';
import { permissionedRegistryAbi, permissionedRegistryBytecode } from '../src/ens/abi/permissionedRegistryAbi.js';
import { permissionedResolverAbi } from '../src/ens/abi/permissionedResolverAbi.js';
import { verifiableFactoryAbi } from '../src/ens/abi/verifiableFactoryAbi.js';
import { ethRegistrarAbi } from '../src/ens/abi/ethRegistrarAbi.js';
import { mockErc20Abi } from '../src/ens/abi/mockErc20Abi.js';
import {
  ETH_REGISTRY_ADDRESS,
  ETH_REGISTRAR_ADDRESS,
  PERMISSIONED_RESOLVER_IMPL_ADDRESS,
  VERIFIABLE_FACTORY_ADDRESS,
  LABEL_STORE_ADDRESS,
  MOCK_USDC_ADDRESS,
  ROLES_ALL,
} from '../src/ens/addresses.js';

const REGISTRY_STATUS_REGISTERED = 2;
const REGISTRATION_DURATION_SECONDS = BigInt(
  process.env.PARENT_REGISTRATION_DURATION_DAYS ? Number(process.env.PARENT_REGISTRATION_DURATION_DAYS) * 86400 : 5 * 365 * 86400,
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function labelHashId(label: string): bigint {
  return BigInt(keccak256(toBytes(label)));
}

async function main() {
  const label = process.env.PARENT_ENS_LABEL;
  if (!label) throw new Error('Set PARENT_ENS_LABEL (e.g. "chainhound") before running this script');

  const publicClient = getEnsPublicClient();
  const walletClient = getEnsWalletClient();
  const signer = getEnsSignerAddress();
  const parentName = `${label}.eth`;

  console.log(`Bootstrapping ENS parent name "${parentName}" for signer ${signer}...`);

  const existingState = await publicClient.readContract({
    address: ETH_REGISTRY_ADDRESS,
    abi: permissionedRegistryAbi,
    functionName: 'getState',
    args: [labelHashId(label)],
  });

  let subregistryAddress: Address;
  let resolverAddress: Address;

  if (existingState.status === REGISTRY_STATUS_REGISTERED) {
    if (existingState.latestOwner.toLowerCase() !== signer.toLowerCase()) {
      throw new Error(`"${parentName}" is already registered to ${existingState.latestOwner}, not our signer (${signer})`);
    }
    console.log(`"${parentName}" is already owned by our signer — reusing it.`);

    const existingSubregistry = await publicClient.readContract({
      address: ETH_REGISTRY_ADDRESS,
      abi: permissionedRegistryAbi,
      functionName: 'getSubregistry',
      args: [label],
    });
    const existingResolver = await publicClient.readContract({
      address: ETH_REGISTRY_ADDRESS,
      abi: permissionedRegistryAbi,
      functionName: 'getResolver',
      args: [label],
    });

    subregistryAddress =
      existingSubregistry !== zeroAddress ? (existingSubregistry as Address) : await deploySubregistry();
    resolverAddress = existingResolver !== zeroAddress ? (existingResolver as Address) : await deployResolver();

    if (existingSubregistry === zeroAddress) {
      console.log('Existing name had no subregistry — pointing it at the freshly deployed one.');
      const hash = await walletClient.writeContract({
        address: ETH_REGISTRY_ADDRESS,
        abi: permissionedRegistryAbi,
        functionName: 'setSubregistry',
        args: [existingState.tokenId, subregistryAddress],
        account: walletClient.account!,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
    if (existingResolver === zeroAddress) {
      console.log('Existing name had no resolver — pointing it at the freshly deployed one.');
      const hash = await walletClient.writeContract({
        address: ETH_REGISTRY_ADDRESS,
        abi: permissionedRegistryAbi,
        functionName: 'setResolver',
        args: [existingState.tokenId, resolverAddress],
        account: walletClient.account!,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }
  } else {
    console.log(`"${parentName}" is available — deploying subregistry + resolver, then registering via ETHRegistrar.`);
    subregistryAddress = await deploySubregistry();
    resolverAddress = await deployResolver();
    await registerParentName(label, subregistryAddress, resolverAddress);
  }

  console.log('\nDone. Add these to your .env:\n');
  console.log(`PARENT_ENS_NAME=${parentName}`);
  console.log(`PARENT_SUBREGISTRY_ADDRESS=${subregistryAddress}`);
  console.log(`PARENT_RESOLVER_ADDRESS=${resolverAddress}`);

  async function deploySubregistry(): Promise<Address> {
    const hash = await walletClient.deployContract({
      abi: permissionedRegistryAbi,
      bytecode: permissionedRegistryBytecode,
      args: [LABEL_STORE_ADDRESS, signer, ROLES_ALL],
      account: walletClient.account!,
      chain: walletClient.chain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (!receipt.contractAddress) throw new Error(`Subregistry deployment (tx ${hash}) returned no contract address`);
    console.log(`Deployed parent subregistry at ${receipt.contractAddress}`);
    return receipt.contractAddress;
  }

  async function deployResolver(): Promise<Address> {
    const salt = BigInt(keccak256(randomBytes(32)));
    const hash = await walletClient.writeContract({
      address: VERIFIABLE_FACTORY_ADDRESS,
      abi: verifiableFactoryAbi,
      functionName: 'deployProxy',
      args: [
        PERMISSIONED_RESOLVER_IMPL_ADDRESS,
        salt,
        encodeInitialize(signer),
      ],
      account: walletClient.account!,
      chain: walletClient.chain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const deployedLog = receipt.logs.find((log) => log.address.toLowerCase() === VERIFIABLE_FACTORY_ADDRESS.toLowerCase());
    if (!deployedLog) throw new Error(`Could not find ProxyDeployed event in receipt for tx ${hash}`);
    // topics[2] is the indexed proxyAddress (32-byte, address right-padded in the low 20 bytes)
    const proxyAddress = `0x${deployedLog.topics[2]!.slice(-40)}` as Address;
    console.log(`Deployed shared resolver at ${proxyAddress}`);
    return proxyAddress;
  }

  function encodeInitialize(admin: Address): Hex {
    return encodeFunctionData({
      abi: permissionedResolverAbi,
      functionName: 'initialize',
      args: [admin, ROLES_ALL, []],
    });
  }

  async function registerParentName(theLabel: string, subregistry: Address, resolver: Address) {
    const secret = `0x${randomBytes(32).toString('hex')}` as Hex;
    const referrer = `0x${'0'.repeat(64)}` as Hex;

    const commitment = await publicClient.readContract({
      address: ETH_REGISTRAR_ADDRESS,
      abi: ethRegistrarAbi,
      functionName: 'makeCommitment',
      args: [theLabel, signer, secret, subregistry, resolver, REGISTRATION_DURATION_SECONDS, referrer],
    });

    console.log('Submitting commitment...');
    let hash = await walletClient.writeContract({
      address: ETH_REGISTRAR_ADDRESS,
      abi: ethRegistrarAbi,
      functionName: 'commit',
      args: [commitment],
      account: walletClient.account!,
      chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    const minCommitmentAge = await publicClient.readContract({
      address: ETH_REGISTRAR_ADDRESS,
      abi: ethRegistrarAbi,
      functionName: 'MIN_COMMITMENT_AGE',
    });
    const waitSeconds = Number(minCommitmentAge) + 5;
    console.log(`Waiting ${waitSeconds}s for the commitment to mature...`);
    await sleep(waitSeconds * 1000);

    const [base, premium] = await publicClient.readContract({
      address: ETH_REGISTRAR_ADDRESS,
      abi: ethRegistrarAbi,
      functionName: 'getRegisterPrice',
      args: [theLabel, REGISTRATION_DURATION_SECONDS, MOCK_USDC_ADDRESS],
    });
    const price = base + premium;

    const balance = await publicClient.readContract({
      address: MOCK_USDC_ADDRESS,
      abi: mockErc20Abi,
      functionName: 'balanceOf',
      args: [signer],
    });
    if (balance < price) {
      console.log(`Minting ${(price - balance).toString()} test MockUSDC to cover the registration price...`);
      hash = await walletClient.writeContract({
        address: MOCK_USDC_ADDRESS,
        abi: mockErc20Abi,
        functionName: 'mint',
        args: [signer, price - balance + 1_000_000n],
        account: walletClient.account!,
        chain: walletClient.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash });
    }

    console.log('Approving ETHRegistrar to spend MockUSDC...');
    hash = await walletClient.writeContract({
      address: MOCK_USDC_ADDRESS,
      abi: mockErc20Abi,
      functionName: 'approve',
      args: [ETH_REGISTRAR_ADDRESS, price],
      account: walletClient.account!,
      chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });

    console.log('Registering...');
    hash = await walletClient.writeContract({
      address: ETH_REGISTRAR_ADDRESS,
      abi: ethRegistrarAbi,
      functionName: 'register',
      args: [theLabel, signer, secret, subregistry, resolver, REGISTRATION_DURATION_SECONDS, MOCK_USDC_ADDRESS, referrer],
      account: walletClient.account!,
      chain: walletClient.chain,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`Registered "${theLabel}.eth" in tx ${receipt.transactionHash}`);

    // Point the freshly registered name's own resolver record at `resolver` too, so
    // `chainhound.eth` itself resolves (not just its subnames).
    const node = namehash(`${theLabel}.eth`);
    hash = await walletClient.writeContract({
      address: resolver,
      abi: permissionedResolverAbi,
      functionName: 'setAddr',
      args: [node, signer],
      account: walletClient.account!,
      chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
