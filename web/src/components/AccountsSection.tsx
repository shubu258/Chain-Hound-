import type { WalletFundFlow, WalletNetworkResult } from "@/lib/types";
import { hasEnsNetwork } from "@/lib/types";

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

/** Finds one transfer with this counterparty so the row can show a relationship + amount. */
function findRelationship(counterparty: string, fundFlow: WalletFundFlow) {
  const c = counterparty.toLowerCase();
  const sent = fundFlow.sent?.find((t) => t.to.toLowerCase() === c);
  if (sent) return { relation: "sent to", amount: `${sent.amount} ${sent.tokenSymbol}`, icon: "↗" };
  const received = fundFlow.received?.find((t) => t.from.toLowerCase() === c);
  if (received) return { relation: "received from", amount: `${received.amount} ${received.tokenSymbol}`, icon: "↙" };
  return { relation: "related", amount: "—", icon: "•" };
}

export function AccountsSection({
  fundFlow,
  ensNetwork,
}: {
  fundFlow: WalletFundFlow;
  ensNetwork: WalletNetworkResult | { error: string };
}) {
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
            <span className="rel-icon">●</span>
            <div className="acc-name">
              <span className="ens mono">{ensNetwork.root.ensName}</span>
              <span className="raw mono">{shortAddress(ensNetwork.root.wallet)} · root wallet</span>
            </div>
            <span className="acc-rel mono">ROOT</span>
            <span className="acc-amount mono">—</span>
            <span className="acc-risk unknown mono">NAMED</span>
          </div>

          {ensNetwork.counterparties.length === 0 ? (
            <p className="empty-note">No counterparty wallets found in this wallet&apos;s transfer history.</p>
          ) : (
            ensNetwork.counterparties.map((counterparty) => {
              const { relation, amount, icon } = findRelationship(counterparty.wallet, fundFlow);
              return (
                <div className="account-row" key={counterparty.wallet}>
                  <span className="rel-icon">{icon}</span>
                  <div className="acc-name">
                    <span className="ens mono">{counterparty.ensName}</span>
                    <span className="raw mono">{shortAddress(counterparty.wallet)}</span>
                  </div>
                  <span className="acc-rel mono">{relation}</span>
                  <span className="acc-amount mono">{amount}</span>
                  <span className="acc-risk unknown mono">NAMED</span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
