const STEPS = [
  {
    idx: "STAGE 01",
    title: "Live data",
    body: "The Graph's Subgraph MCP pulls real transaction history — not a cached snapshot.",
  },
  {
    idx: "STAGE 02",
    title: "Fund flow",
    body: "The Graph's Token API reconstructs every sent and received transfer across every token.",
  },
  {
    idx: "STAGE 03",
    title: "Risk analysis",
    body: "Fund flow, bridging, and protocol behavior are scored and explained in plain language.",
  },
  {
    idx: "STAGE 04",
    title: "Onchain identity",
    body: "Every wallet in the trail gets a readable ENSv2 name, so the report reads like names, not hex.",
  },
];

export function PipelineSection() {
  return (
    <section className="pipeline" id="pipeline">
      <div className="wrap">
        <div className="section-head">
          <h2>How the trail is built</h2>
        </div>
        <div className="pipeline-steps">
          {STEPS.map((step) => (
            <div className="pipeline-step" key={step.idx}>
              <div className="idx">{step.idx}</div>
              <h4>{step.title}</h4>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
