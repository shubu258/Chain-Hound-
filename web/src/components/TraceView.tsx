import type { TraceFundFlowResponse } from "@/lib/types";

const LABEL_COLOR: Record<string, string> = {
  Critical: "var(--rust)",
  High: "var(--rust)",
  Medium: "var(--amber)",
  Low: "var(--moss)",
};

function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}...${address.slice(-6)}` : address;
}

// The wallet's own short label is the first segment of its ENS name — the rest is the parent
// chain (root wallet's name + chainhound.eth), an implementation detail of the hierarchy.
function leafLabel(ensName: string): string {
  return ensName.split(".")[0] ?? ensName;
}

function WalletName({ wallet, ensName }: { wallet: string; ensName?: string }) {
  if (!ensName) return <span className="ens mono">{shortAddress(wallet)}</span>;
  return (
    <span className="acc-label-wrap ens mono" title={ensName} tabIndex={0}>
      {leafLabel(ensName)}
      <span className="acc-tooltip mono">{ensName}</span>
    </span>
  );
}

export function TraceView({ result }: { result: TraceFundFlowResponse }) {
  const root = result.nodes.find((n) => n.depth === 0);
  const hops = result.nodes.filter((n) => n.depth === 1);
  const { overallRisk } = result;
  const overallColor = overallRisk.label ? (LABEL_COLOR[overallRisk.label] ?? "var(--orange)") : "var(--ink-soft)";

  return (
    <>
      <section className="report" id="report">
        <div className="wrap">
          <div className="section-head">
            <h2>Fund trace</h2>
            <span className="addr mono">
              {result.rootWallet} · {result.stats.totalNodesAnalyzed} wallets · {result.stats.totalEdgesFound} transfers
              followed
            </span>
          </div>

          <div className="score-block">
            <p className="score-num" style={{ color: overallColor }}>
              {overallRisk.score ?? "—"}
            </p>
            <p className="score-label">{overallRisk.label ? `${overallRisk.label.toUpperCase()} RISK` : "UNSCORED"}</p>
            <div className="score-bar">
              <div
                className="score-bar-fill"
                style={{
                  width: overallRisk.score !== undefined ? `${Math.min(100, Math.max(0, overallRisk.score))}%` : "0%",
                  background: overallColor,
                }}
              />
            </div>
            <div className="score-meta">
              <span className={`acc-risk ${overallRisk.passed ? "low" : "high"} mono`}>
                {overallRisk.passed ? "✓ TRAIL PASSED" : "✗ TRAIL FAILED"}
              </span>
              <span>
                {overallRisk.scoredNodes}/{overallRisk.totalNodes} wallets scored
              </span>
            </div>
            <p className="raw mono" style={{ marginTop: 8 }}>
              {overallRisk.reason}
            </p>
          </div>

          <div className="account-list">
            {root && (
              <div className="account-row root">
                <span className="rel-icon">●</span>
                <div className="acc-name">
                  <WalletName wallet={root.wallet} ensName={root.ensName} />
                  <span className="raw mono">root wallet</span>
                </div>
                <span className="acc-rel mono">ROOT</span>
                <span className="acc-amount mono">—</span>
                <RiskBadge riskScore={root.riskScore} riskLabel={root.riskLabel} error={root.error} />
              </div>
            )}

            {hops.map((node) => {
              const edge = result.edges.find((e) => e.to.toLowerCase() === node.wallet.toLowerCase());
              return (
                <div className="account-row" key={node.wallet}>
                  <span className="rel-icon">↗</span>
                  <div className="acc-name">
                    <WalletName wallet={node.wallet} ensName={node.ensName} />
                    <span className="raw mono">
                      {node.isSink ? `sink${node.sinkType ? ` · ${node.sinkType}` : ""}` : "1 hop out"}
                    </span>
                  </div>
                  <span className="acc-rel mono">sent to</span>
                  <span className="acc-amount mono">{edge ? `${edge.amount} ${edge.token}` : "—"}</span>
                  <RiskBadge riskScore={node.riskScore} riskLabel={node.riskLabel} error={node.error} />
                </div>
              );
            })}

            {hops.length === 0 && <p className="empty-note">No recent outgoing transfers to trace.</p>}
          </div>
        </div>
      </section>
    </>
  );
}

function RiskBadge({ riskScore, riskLabel, error }: { riskScore?: number; riskLabel?: string; error?: true }) {
  if (error) return <span className="acc-risk unknown mono">ERROR</span>;
  if (riskScore === undefined || !riskLabel) return <span className="acc-risk unknown mono">UNSCORED</span>;
  const cls = riskLabel === "Critical" || riskLabel === "High" ? "high" : riskLabel === "Medium" ? "medium" : "low";
  return (
    <span className={`acc-risk ${cls} mono`} style={{ color: LABEL_COLOR[riskLabel] }}>
      {riskLabel.toUpperCase()} · {riskScore}
    </span>
  );
}
