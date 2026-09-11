// Deterministic ENS label derivation for wallet addresses. Same address always yields the same
// label, so the same wallet is instantly recognizable by name wherever it shows up in the
// network (as a root, or as a counterparty under a different root).

/** `0xAbCd...1234` -> `abcd...1234` (lowercased, 0x stripped) — a valid, collision-free ENS label. */
export function addressToLabel(address: string): string {
  return address.toLowerCase().replace(/^0x/, '');
}

/** Builds the full ENS name for a label registered under `parentName`. */
export function buildEnsName(label: string, parentName: string): string {
  return `${label}.${parentName}`;
}
