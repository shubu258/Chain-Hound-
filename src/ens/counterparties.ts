import type { WalletFundFlow } from '../analyseData/analyseData.js';

/**
 * Unique counterparty addresses from a wallet's fund flow: every "to" from what it sent, every
 * "from" of what it received. Lowercased and deduplicated, with the root wallet itself excluded
 * (a wallet is never its own counterparty).
 */
export function extractCounterparties(rootWallet: string, fundFlow: WalletFundFlow): string[] {
  const root = rootWallet.toLowerCase();
  const addresses = new Set<string>();

  for (const transfer of fundFlow.sent ?? []) addresses.add(transfer.to.toLowerCase());
  for (const transfer of fundFlow.received ?? []) addresses.add(transfer.from.toLowerCase());
  addresses.delete(root);

  return [...addresses];
}
