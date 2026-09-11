import type { ProgressEvent } from "@/lib/types";

const ICON: Record<ProgressEvent["status"], string> = { start: "…", done: "✓", error: "✗" };

export function ProgressChecklist({ steps }: { steps: ProgressEvent[] }) {
  if (steps.length === 0) return null;

  return (
    <div className="progress-list">
      {steps.map((step) => (
        <div className="progress-item" key={step.step}>
          <span className={`progress-icon ${step.status} mono`}>{ICON[step.status]}</span>
          <span className="progress-label mono">{step.label}</span>
          {step.status === "error" && step.detail && <span className="progress-detail mono">{step.detail}</span>}
        </div>
      ))}
    </div>
  );
}
