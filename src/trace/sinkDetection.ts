// Known-sink lookup for fund tracing (src/trace/traceEngine.ts). A "sink" is a wallet the trace
// should stop at rather than expand past — for a known exchange address, expanding further would
// mean walking into that exchange's own internal hot-wallet shuffling, which isn't the money
// trail we're following anymore.
//
// LIMITATION: this is a small hardcoded seed list of well-known CEX deposit/hot wallets, not a
// real address-labeling service. Expand it, or replace it with a proper labeling API (e.g. an
// Etherscan label export, Arkham, or a Graph-indexed labels subgraph), before relying on this for
// anything beyond a demo.
const KNOWN_SINKS: Record<string, string> = {
  // Binance hot wallets
  '0x28c6c06298d514db089934071355e5743bf21d60': 'Binance',
  '0x21a31ee1afc51d94c2efccaa2092ad1028285549': 'Binance',
  '0xdfd5293d8e347dfe59e90efd55b2956a1343963d': 'Binance',
  // Coinbase hot wallets
  '0x71660c4005ba85c37ccec55d0c4493e66fe775d3': 'Coinbase',
  '0x503828976d22510aad0201ac7ec88293211d23da': 'Coinbase',
  '0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740': 'Coinbase',
};

export interface SinkCheckResult {
  isSink: boolean;
  sinkType?: string;
}

/**
 * Checks a wallet against the known-exchange seed list above. The other sink condition — a
 * wallet with zero outgoing transfers ("dead_end") — depends on the per-hop analyzeWallet result
 * and is therefore checked in traceEngine.ts, not here.
 */
export function isKnownSink(walletAddress: string): SinkCheckResult {
  const label = KNOWN_SINKS[walletAddress.toLowerCase()];
  return label ? { isSink: true, sinkType: label } : { isSink: false };
}
