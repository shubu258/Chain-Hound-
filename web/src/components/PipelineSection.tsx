const STEPS = [
  {
    idx: "STAGE 01",
    title: "Live data",
    tech: "THE GRAPH · SUBGRAPH MCP",
    steps: ["subgraph:swaps", "subgraph:lending"],
    body: "A natural-language agent runs prescribed queries against Uniswap V3 and Aave V3 subgraphs — live indexed data, not a cached snapshot or a mock fixture.",
  },
  {
    idx: "STAGE 02",
    title: "Fund flow",
    tech: "ETHERS.JS · RPC LOGS",
    steps: ["fundflow"],
    body: "In parallel, ethers.js scans Transfer event logs directly against an RPC node to reconstruct every token this wallet has sent and received — the spine the trace walks.",
  },
  {
    idx: "STAGE 03",
    title: "Risk analysis",
    tech: "GEMINI / CLAUDE · STRUCTURED EVIDENCE",
    steps: ["risk"],
    body: "The model never invents a score — it explains a severity, a title, and a detail per flag over the fund-flow + protocol data it's given, and states plainly what it can't see.",
  },
  {
    idx: "STAGE 04",
    title: "Onchain identity",
    tech: "ENSv2 · SEPOLIA",
    steps: ["ens:root", "ens:counterparty:n"],
    body: "Every wallet in the trail is registered as a real ENSv2 subname under its own subregistry, so the report reads root.chainhound.eth and its counterparties, not raw hex.",
  },
  {
    idx: "STAGE 05",
    title: "Trail verification",
    tech: "1-HOP RE-VERIFICATION",
    steps: ["trace:wallet1", "trace:wallet2", "trace:wallet3"],
    body: "Fund Trace mode re-runs stages 01–04 on the root wallet's most recent counterparties, one hop out — Wallet 1, Wallet 2, Wallet 3… each link in the trail independently scored, not just displayed.",
  },
];

export function PipelineSection() {
  return (
    <section className="pipeline" id="pipeline">
      <div className="wrap">
        <div className="section-head">
          <h2>How the trail is built</h2>
          <span className="addr mono">
            <span className="pipeline-legend">
              <span className="live-line-legend start">…</span> running
              <span className="live-line-legend done">✓</span> done
              <span className="live-line-legend error">✗</span> failed
            </span>
          </span>
        </div>
        <p className="pipeline-intro mono">
          Every stage below streams into the live console above as your investigation runs — the step keys shown
          are the exact lines you&apos;ll see, in order, in real time. Nothing here is precomputed.
        </p>
        <div className="pipeline-path">
          {STEPS.map((step, i) => (
            <div className="path-step" key={step.idx}>
              <div className="path-node mono">{String(i + 1).padStart(2, "0")}</div>
              <div className="path-card">
                <h4>{step.title}</h4>
                <p>{step.body}</p>
                <div className="pipeline-tech mono">{step.tech}</div>
                <div className="pipeline-keys mono">
                  {step.steps.map((key) => (
                    <span className="pipeline-key" key={key}>
                      {key}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
