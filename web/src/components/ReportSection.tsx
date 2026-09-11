import type { RiskAnalysis, WalletFundFlow } from "@/lib/types";
import { hasRiskScore } from "@/lib/types";

const SEVERITY_CLASS: Record<string, string> = { High: "high", Medium: "medium", Low: "low" };
const LABEL_COLOR: Record<string, string> = {
  Critical: "var(--rust)",
  High: "var(--rust)",
  Medium: "var(--amber)",
  Low: "var(--moss)",
};

export function ReportSection({
  walletAddress,
  chain,
  fundFlow,
  riskAnalysis,
}: {
  walletAddress: string;
  chain: string;
  fundFlow: WalletFundFlow;
  riskAnalysis: RiskAnalysis | { error: string };
}) {
  const runAt = new Date().toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  const scored = hasRiskScore(riskAnalysis);
  const accentColor = scored ? (LABEL_COLOR[riskAnalysis.riskLabel] ?? "var(--orange)") : "var(--ink-soft)";

  return (
    <section className="report" id="report">
      <div className="wrap">
        <div className="section-head">
          <h2>Investigation report</h2>
          <span className="addr mono">
            {walletAddress} · run {runAt}
          </span>
        </div>

        <div className="report-grid">
          <div className="score-block">
            <p className="score-num" style={{ color: accentColor }}>
              {scored ? riskAnalysis.riskScore : "—"}
            </p>
            <p className="score-label">{scored ? `${riskAnalysis.riskLabel.toUpperCase()} RISK` : "UNSCORED"}</p>
            <div className="score-bar">
              <div
                className="score-bar-fill"
                style={{
                  width: scored ? `${Math.min(100, Math.max(0, riskAnalysis.riskScore))}%` : "0%",
                  background: accentColor,
                }}
              />
            </div>
            <div className="score-meta">
              <span>
                Chain <b>{chain}</b>
              </span>
              <span>
                Sent transfers <b>{fundFlow.error ? "n/a" : (fundFlow.sent?.length ?? 0)}</b>
              </span>
              <span>
                Received transfers <b>{fundFlow.error ? "n/a" : (fundFlow.received?.length ?? 0)}</b>
              </span>
            </div>
          </div>

          <div>
            {!scored ? (
              <div className="error-note">Risk analysis unavailable: {riskAnalysis.error}</div>
            ) : (
              <>
                <div className="summary-box">
                  <div className="box-header">
                    <span className="tdot" style={{ background: "#E5766B" }} />
                    <span className="tdot" style={{ background: "#E3B15B" }} />
                    <span className="tdot" style={{ background: "#7FC26E" }} />
                    <span className="filename">summary.diff</span>
                  </div>
                  <div className="summary-lines">
                    {riskAnalysis.positiveSignals.map((signal, i) => (
                      <div className="line pos" key={`pos-${i}`}>
                        <span className="sym">+</span>
                        <span className="txt">{signal}</span>
                      </div>
                    ))}
                    {riskAnalysis.flags.map((flag, i) => (
                      <div className="line neg" key={`neg-${i}`}>
                        <span className="sym">−</span>
                        <span className="txt">{flag.title}</span>
                      </div>
                    ))}
                    {riskAnalysis.positiveSignals.length === 0 && riskAnalysis.flags.length === 0 && (
                      <div className="line">
                        <span className="txt">{riskAnalysis.summary}</span>
                      </div>
                    )}
                  </div>
                </div>

                {riskAnalysis.flags.length > 0 && (
                  <div className="flags-wrap">
                    <h3>FLAGGED SIGNALS</h3>
                    {riskAnalysis.flags.map((flag, i) => (
                      <div className="flag-card" key={i}>
                        <span className={`sev-pill ${SEVERITY_CLASS[flag.severity] ?? "low"}`}>
                          {flag.severity.toUpperCase()}
                        </span>
                        <div className="flag-body">
                          <div className="flag-title">{flag.title}</div>
                          <div className="flag-detail">{flag.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {riskAnalysis.dataGaps.length > 0 && (
                  <div className="flags-wrap">
                    <h3>DATA GAPS</h3>
                    {riskAnalysis.dataGaps.map((gap, i) => (
                      <div className="flag-card" key={i}>
                        <span className="sev-pill low">GAP</span>
                        <div className="flag-body">
                          <div className="flag-detail">{gap}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
