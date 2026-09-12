"use client";

import { useRef, useState } from "react";
import { analyzeWallet, traceWallet } from "@/lib/api";
import type { ProgressEvent, TraceFundFlowResponse, WalletAnalysisResponse } from "@/lib/types";
import { ReportSection } from "./ReportSection";
import { AccountsSection } from "./AccountsSection";
import { TraceView } from "./TraceView";
import { LiveStatus, type LiveStatusLine } from "./LiveStatus";

type Mode = "wallet" | "trace";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export function InvestigationView() {
  const [walletAddress, setWalletAddress] = useState("");
  const [mode, setMode] = useState<Mode>("wallet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletResult, setWalletResult] = useState<WalletAnalysisResponse | null>(null);
  const [traceResult, setTraceResult] = useState<TraceFundFlowResponse | null>(null);
  const [lines, setLines] = useState<LiveStatusLine[]>([]);
  const startedAtRef = useRef(0);

  function recordStep(event: ProgressEvent) {
    const elapsedMs = Date.now() - startedAtRef.current;
    setLines((prev) => {
      const i = prev.findIndex((s) => s.step === event.step);
      if (i === -1) return [...prev, { ...event, elapsedMs }];
      const next = [...prev];
      next[i] = { ...event, elapsedMs: next[i].elapsedMs };
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!ADDRESS_RE.test(walletAddress.trim())) {
      setError("Enter a valid EVM address (0x + 40 hex characters)");
      return;
    }

    setLoading(true);
    setWalletResult(null);
    setTraceResult(null);
    setLines([]);
    startedAtRef.current = Date.now();
    try {
      if (mode === "wallet") {
        setWalletResult(await analyzeWallet(walletAddress.trim(), recordStep));
      } else {
        setTraceResult(await traceWallet(walletAddress.trim(), recordStep));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Investigation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="hero" id="investigate">
        <div className="wrap">
          <div className="case-tag mono">
            <span className="dot" />
            CASE FILE — WALLET INVESTIGATION
            <span className="rule" />
          </div>
          <div className="hero-grid">
            <div>
              <h1 className="headline">
                Every wallet
                <br />
                leaves <em>a trail.</em>
              </h1>
              <p className="lede">
                Give ChainHound an address. It reads the wallet&apos;s full history, follows where its funds came from
                and went, and names every account it finds along the way.
              </p>
            </div>

            <form className="investigate-card" onSubmit={handleSubmit}>
              <div className="card-title">
                NEW INVESTIGATION
                <span className="mono" style={{ color: "#9C9576" }}>
                  {mode === "wallet" ? "/api/wallet" : "/api/trace"}
                </span>
              </div>
              <div className="field">
                <label htmlFor="wallet-addr">Wallet address</label>
                <input
                  type="text"
                  id="wallet-addr"
                  placeholder="0x8f3a91c2b7e4a1f0d9c6b5e3a2f1d0c9b8a7e6f5"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  spellCheck={false}
                />
              </div>
              <div className="mode-toggle">
                <button type="button" className={mode === "wallet" ? "active" : ""} onClick={() => setMode("wallet")}>
                  Wallet Analysis
                </button>
                <button type="button" className={mode === "trace" ? "active" : ""} onClick={() => setMode("trace")}>
                  Fund Trace
                </button>
              </div>
              <button className="btn-investigate" type="submit" disabled={loading}>
                {loading ? "Investigating…" : "Investigate →"}
              </button>
              <p className="hint">Every wallet found is named onchain via ENSv2</p>
              {error && <div className="error-note">{error}</div>}
            </form>
          </div>
        </div>
      </section>

      <section className="live-status-section" id="live-status">
        <div className="wrap">
          <div className="section-head">
            <h2>Live workflow</h2>
            <span className="addr mono">
              {mode === "wallet" ? "/api/wallet" : "/api/trace"} ·{" "}
              {loading ? "streaming" : lines.length > 0 ? "finished" : "idle"}
            </span>
          </div>
          <LiveStatus lines={lines} endpoint={mode === "wallet" ? "/api/wallet" : "/api/trace"} live={loading} />
        </div>
      </section>

      {walletResult && (
        <>
          <ReportSection
            walletAddress={walletResult.walletAddress}
            chain={walletResult.chain}
            fundFlow={walletResult.fundFlow}
            riskAnalysis={walletResult.riskAnalysis}
          />
          <AccountsSection ensNetwork={walletResult.ensNetwork} />
        </>
      )}

      {traceResult && <TraceView result={traceResult} />}
    </>
  );
}
