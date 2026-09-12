import type { WalletNetworkResult } from "@/lib/types";
import { hasEnsNetwork } from "@/lib/types";

function indexLabel(i: number): string {
  return String(i + 1).padStart(2, "0");
}

// The wallet's own short label is the first segment of its ENS name — the rest is the parent
// chain (root wallet's name + chainhound.eth), an implementation detail of the hierarchy, not
// part of what a person would actually say/remember.
function leafLabel(ensName: string): string {
  return ensName.split(".")[0] ?? ensName;
}

export function AccountsSection({ ensNetwork }: { ensNetwork: WalletNetworkResult | { error: string } }) {
  if (!hasEnsNetwork(ensNetwork)) {
    return (
      <section className="accounts" id="accounts">
        <div className="wrap">
          <div className="section-head">
            <h2>Named accounts</h2>
            <span className="addr mono">ENSv2 / Sepolia</span>
          </div>
          <p className="empty-note">ENS naming unavailable: {ensNetwork.error}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="accounts" id="accounts">
      <div className="wrap">
        <div className="section-head">
          <h2>Named accounts</h2>
          <span className="addr mono">registered onchain · ENSv2 / Sepolia</span>
        </div>

        <div className="account-list">
          <div className="account-row root">
            <span className="acc-index">●</span>
            <span className="acc-label-wrap" title={ensNetwork.root.ensName} tabIndex={0}>
              <span className="acc-label">{leafLabel(ensNetwork.root.ensName)}</span>
              <span className="acc-tooltip mono">{ensNetwork.root.ensName}</span>
            </span>
            <span className="acc-status mono">✓ onchain</span>
          </div>

          {ensNetwork.counterparties.length === 0 ? (
            <p className="empty-note">No counterparty wallets found in this wallet&apos;s transfer history.</p>
          ) : (
            ensNetwork.counterparties.map((counterparty, i) => (
              <div className="account-row" key={counterparty.wallet}>
                <span className="acc-index mono">{indexLabel(i)}</span>
                <span className="acc-label-wrap" title={counterparty.ensName} tabIndex={0}>
                  <span className="acc-label">{leafLabel(counterparty.ensName)}</span>
                  <span className="acc-tooltip mono">{counterparty.ensName}</span>
                </span>
                <span className="acc-status mono">✓ onchain</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
