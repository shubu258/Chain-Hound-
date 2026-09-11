import type { ApiError, TraceFundFlowResponse, WalletAnalysisResponse } from "./types";

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T | ApiError;
  if (!res.ok) {
    throw new Error((json as ApiError).error ?? `Request to ${path} failed (${res.status})`);
  }
  return json as T;
}

export function analyzeWallet(walletAddress: string): Promise<WalletAnalysisResponse> {
  return postJson<WalletAnalysisResponse>("/api/wallet", { walletAddress });
}

export function traceWallet(walletAddress: string): Promise<TraceFundFlowResponse> {
  return postJson<TraceFundFlowResponse>("/api/trace", { walletAddress });
}
