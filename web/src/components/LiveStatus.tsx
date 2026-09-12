"use client";

import { useEffect, useRef } from "react";
import type { ProgressEvent } from "@/lib/types";

const ICON: Record<ProgressEvent["status"], string> = { start: "…", done: "✓", error: "✗" };

export interface LiveStatusLine extends ProgressEvent {
  /** ms elapsed since the investigation started, captured client-side when the line first arrived. */
  elapsedMs: number;
}

function formatElapsed(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

// Backend errors (e.g. a raw Gemini 429 body) can be a long unbroken JSON blob — CSS ellipsis
// handles the visual overflow, but truncating the string itself keeps the DOM/log readable too.
function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

/**
 * A light, code-editor-style live log of pipeline checkpoints as they stream in from the NDJSON
 * response (see lib/api.ts's streamNdjson). Always rendered — even before an investigation has
 * started — so the workflow is visible on the page rather than only appearing once a request is
 * in flight; it just shows an idle prompt until then.
 */
export function LiveStatus({ lines, endpoint, live }: { lines: LiveStatusLine[]; endpoint: string; live: boolean }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const idle = lines.length === 0 && !live;

  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div className="live-console">
      <div className="box-header">
        <span className="tdot" style={{ background: "#E5766B" }} />
        <span className="tdot" style={{ background: "#E3B15B" }} />
        <span className="tdot" style={{ background: "#7FC26E" }} />
        <span className="filename">investigation.log</span>
        <span className={`live-badge mono ${idle ? "idle" : live ? "live" : "done"}`}>
          <span className="live-dot" />
          {idle ? "READY" : live ? "LIVE" : "DONE"}
        </span>
      </div>
      <div className="live-console-body mono" ref={bodyRef}>
        <div className="live-line meta">
          <span className="ts">[0.0s]</span>
          <span className="glyph">$</span>
          <span className="label">{idle ? `awaiting POST ${endpoint}` : `POST ${endpoint}`}</span>
        </div>
        {lines.map((line, i) => (
          <div className={`live-line ${line.status}`} key={`${line.step}-${i}`}>
            <span className="ts">[{formatElapsed(line.elapsedMs)}]</span>
            <span className="glyph">{ICON[line.status]}</span>
            <span className="label">{line.label}</span>
            {line.detail && <span className="detail">— {truncate(line.detail)}</span>}
          </div>
        ))}
        {(live || idle) && (
          <div className="live-line meta">
            <span className="ts">&nbsp;</span>
            <span className="caret">▍</span>
          </div>
        )}
      </div>
    </div>
  );
}
