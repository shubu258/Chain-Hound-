// Real ENSv2 Sepolia deployment addresses, pulled from ensdomains/contracts-v2's own build
// artifacts (deployments/sepolia/*.json), not guessed. Re-verify against
// https://docs.ens.domains/learn/deployments/ if ENSv2's Sepolia deployment is ever redeployed.

export const ETH_REGISTRY_ADDRESS = '0x67b728a792e789a8978b30cf1b3b641f19354b43' as const;
export const ETH_REGISTRAR_ADDRESS = '0xa4449a0dd2b83007553d9b1d28b583a46a805a30' as const;
export const PERMISSIONED_RESOLVER_IMPL_ADDRESS = '0x7e4b2d59938930168024201752ee5503df402303' as const;
export const VERIFIABLE_FACTORY_ADDRESS = '0x118bc31a50d559f7015a8da26d54b3b030cdb70f' as const;
export const LABEL_STORE_ADDRESS = '0xb03524289c16424f71802a1794c29c7bd1b9f577' as const;
export const MOCK_USDC_ADDRESS = '0xd3322b29a7bdee707d1684676f149bf41aa3422f' as const;

// PermissionedRegistry/PermissionedResolver role bitmap layout: each role occupies a 4-bit-spaced
// slot in the low 128 bits, with an "admin" (can-grant) variant of the same role at +128 bits.
// See RegistryRolesLib.sol / EACBaseRolesLib.sol in ensdomains/contracts-v2.
function role(bit: bigint) {
  return { base: 1n << bit, admin: 1n << (bit + 128n) };
}

const REGISTRAR = role(0n);
const SET_SUBREGISTRY = role(20n);
const SET_RESOLVER = role(24n);
const RESOLVER_SET_ADDR = role(0n);
const RESOLVER_SET_TEXT = role(4n);

/** Full role bitmap (base + admin bits) granted to our signer on every registry/resolver we deploy. */
export const ROLES_ALL =
  REGISTRAR.base |
  REGISTRAR.admin |
  SET_SUBREGISTRY.base |
  SET_SUBREGISTRY.admin |
  SET_RESOLVER.base |
  SET_RESOLVER.admin |
  RESOLVER_SET_ADDR.base |
  RESOLVER_SET_ADDR.admin |
  RESOLVER_SET_TEXT.base |
  RESOLVER_SET_TEXT.admin;

export const MAX_EXPIRY = (1n << 64n) - 1n;
export const MIN_REGISTER_DURATION_SECONDS = 28n * 24n * 60n * 60n; // 28 days, per ENSv2 StandardRegistrar
