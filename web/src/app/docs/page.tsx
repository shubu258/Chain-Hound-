import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "ChainHound — Wallet Verification API",
  description: "Screen a wallet's on-chain history before you let it in — a risk score and label any platform can threshold on.",
};

export default function DocsPage() {
  return (
    <>
      <SiteNav />
      <section className="report" id="docs">
        <div className="wrap">
          <div className="section-head">
            <h2>Wallet Verification API</h2>
            <span className="addr mono">machine-callable — no login, no dashboard</span>
          </div>
          <p className="lede" style={{ marginBottom: 20, maxWidth: "70ch" }}>
            No platform wants a malicious wallet walking in the front door. ChainHound reads a wallet&apos;s real
            on-chain history and hands back a risk score — you decide the threshold. &quot;Reject anything above
            40&quot; is a one-line check against a response field, not a research project.
          </p>
          <p className="lede" style={{ marginBottom: 40, maxWidth: "70ch" }}>
            Two verification depths, same <code className="mono">riskScore</code> /{" "}
            <code className="mono">riskLabel</code> shape both times — pick the one that matches how much you need
            to trust the answer:
          </p>

          <div className="doc-endpoint">
            <div className="doc-endpoint-head">
              <span className="doc-method mono">POST</span>
              <span className="doc-path mono">/api/agent/wallet</span>
              <span className="doc-depth mono">shallow · fast</span>
            </div>
            <p>
              <strong>Single-wallet verification.</strong> Risk-scores one address from its own transaction history
              alone — Uniswap V3 swaps, Aave V3 lending, on-chain fund flow. No counterparties followed. Use this
              when you just need &quot;is this one address clean?&quot; before an approval, deposit, or sign-up.
            </p>
            <div className="doc-code-grid">
              <div>
                <div className="doc-code-label mono">Request</div>
                <pre className="doc-code mono">{`{
  "walletAddress": "0x8f3a91c2b7e4a1f0d9c6b5e3a2f1d0c9b8a7e6f5"
}`}</pre>
              </div>
              <div>
                <div className="doc-code-label mono">Response</div>
                <pre className="doc-code mono">{`{
  "walletAddress": "0x8f3a...",
  "chain": "mainnet",
  "swaps": { "...": "raw Uniswap V3 result" },
  "lending": { "...": "raw Aave V3 result" },
  "fundFlow": { "sent": [...], "received": [...] },
  "riskAnalysis": {
    "riskScore": 62,
    "riskLabel": "Medium",
    "flags": [ { "severity": "Medium",
      "title": "..." } ],
    "positiveSignals": [ "..." ]
  },
  "ensNetwork": {
    "root": { "ensName":
      "amber-zephyr-152.chainhound.eth" }
  }
}`}</pre>
                <p className="hint" style={{ textAlign: "left", marginTop: 8 }}>
                  If scoring fails, <code className="mono">riskAnalysis</code> is <code className="mono">{`{ error: string }`}</code> instead
                  — no <code className="mono">riskScore</code>. Check for <code className="mono">.error</code> first.
                </p>
              </div>
            </div>
          </div>

          <div className="doc-endpoint">
            <div className="doc-endpoint-head">
              <span className="doc-method mono">POST</span>
              <span className="doc-path mono">/api/agent/trace</span>
              <span className="doc-depth mono">deep · more secure</span>
            </div>
            <p>
              <strong>Trail verification.</strong> Verifies the wallet plus its most recent outgoing counterparties
              (one hop out), risk-scores each independently, and rolls the results into one deterministic pass/fail
              trail verdict — the trail is only as clean as its riskiest link. Use this for higher-stakes gates
              (large withdrawals, custody onboarding) where a clean wallet fed by a dirty one still shouldn&apos;t
              pass. Every wallet returned is also registered as a real ENSv2 subname on Sepolia.
            </p>
            <div className="doc-code-grid">
              <div>
                <div className="doc-code-label mono">Request</div>
                <pre className="doc-code mono">{`{
  "walletAddress": "0x8f3a91c2b7e4a1f0d9c6b5e3a2f1d0c9b8a7e6f5"
}`}</pre>
              </div>
              <div>
                <div className="doc-code-label mono">Response</div>
                <pre className="doc-code mono">{`{
  "rootWallet": "0x8f3a...",
  "nodes": [
    { "wallet": "0x8f3a...", "depth": 0,
      "riskScore": 62, "riskLabel": "Medium",
      "isSink": false },
    { "wallet": "0x1a2b...", "depth": 1,
      "riskScore": 88, "riskLabel": "High",
      "isSink": false }
  ],
  "edges": [ { "from": "0x8f3a...", "to": "0x1a2b...",
    "amount": "1.4", "token": "ETH", "timestamp": 1234 } ],
  "stats": { "totalNodesAnalyzed": 2, "totalEdgesFound": 1 },
  "overallRisk": { "score": 88, "label": "High",
    "passed": false, "scoredNodes": 2, "totalNodes": 2,
    "reason": "Highest risk in this trail comes from
      a wallet 1 hop out (0x1a2b...): High (88/100)" }
}`}</pre>
                <p className="hint" style={{ textAlign: "left", marginTop: 8 }}>
                  If <code className="mono">scoredNodes</code> is 0, <code className="mono">overallRisk.score</code> is absent and{" "}
                  <code className="mono">passed</code> is <code className="mono">false</code> (fails closed) — nothing in the trail could be scored, not
                  &quot;the trail is clean.&quot;
                </p>
              </div>
            </div>
          </div>

          <div className="doc-endpoint">
            <div className="doc-endpoint-head">
              <span className="doc-method mono">POST</span>
              <span className="doc-path mono">/api/agent/uniswap-activity</span>
              <span className="doc-depth mono">supporting · chainable</span>
            </div>
            <p>
              Live Uniswap V3 subgraph lookup (via The Graph&apos;s Subgraph MCP) for one wallet&apos;s recent swap
              activity — the same lookup the two verification endpoints above run internally, exposed standalone so
              it can be chained as its own step (e.g. pull this as supporting evidence after a wallet is flagged).
            </p>
            <div className="doc-code-grid">
              <div>
                <div className="doc-code-label mono">Request</div>
                <pre className="doc-code mono">{`{
  "walletAddress": "0x8f3a91c2b7e4a1f0d9c6b5e3a2f1d0c9b8a7e6f5"
}`}</pre>
              </div>
              <div>
                <div className="doc-code-label mono">Response</div>
                <pre className="doc-code mono">{`{
  "walletAddress": "0x8f3a...",
  "chain": "mainnet",
  "swaps": { "...": "raw Uniswap V3 subgraph result" }
}`}</pre>
              </div>
            </div>
          </div>

          <div className="doc-endpoint" style={{ borderBottom: "none" }}>
            <div className="doc-endpoint-head">
              <span className="doc-depth mono">integration</span>
            </div>
            <p>
              How a platform actually uses this — apply your own threshold to the score. Check for a failed/missing
              score <strong>first</strong>: <code className="mono">riskScore &gt; threshold</code> silently evaluates to
              <code className="mono">false</code> when the score is missing, which fails <em>open</em> — exactly the
              wrong default for a gate meant to keep malicious wallets out.
            </p>
            <pre className="doc-code mono" style={{ maxWidth: "60ch" }}>{`const res = await fetch("https://chain-hound-production.up.railway.app/api/agent/wallet", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ walletAddress }),
});
const { riskAnalysis } = await res.json();

if ("error" in riskAnalysis || riskAnalysis.riskScore === undefined) {
  // couldn't be scored — fail closed (flag for manual review), don't wave it through
} else if (riskAnalysis.riskScore > 40) {
  // block, flag for review, or route to /api/agent/trace for a deeper check
}`}</pre>
          </div>

          <p className="hint" style={{ textAlign: "left", marginTop: 8 }}>
            Full OpenAPI 3.0 spec:{" "}
            <a href="/openapi/chainhound.json" className="mono">
              /openapi/chainhound.json
            </a>{" "}
            — paste this URL into Bazantic&apos;s Spec URL field, or any OpenAPI-compatible client, to wire these up
            as callable tools.
          </p>
        </div>
      </section>
      <SiteFooter />
    </>
  );
}
