import type { ApiError, ProgressEvent, TraceFundFlowResponse, WalletAnalysisResponse } from "./types";

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

type WalletStreamLine =
  | ({ type: "progress" } & ProgressEvent)
  | { type: "result"; data: WalletAnalysisResponse }
  | { type: "fatal"; error: string };

/**
 * POST /api/wallet streams newline-delimited JSON (see Routes/dataFetching.ts) instead of one
 * blocking response, since the full pipeline can take a while — each step is reported to
 * `onProgress` as it happens, and the final result resolves the returned promise.
 */
export async function analyzeWallet(
  walletAddress: string,
  onProgress?: (event: ProgressEvent) => void,
): Promise<WalletAnalysisResponse> {
  const res = await fetch("/api/wallet", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(json?.error ?? `Request to /api/wallet failed (${res.status})`);
  }
  if (!res.body) {
    throw new Error("This browser does not support streaming responses");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: WalletAnalysisResponse | null = null;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;

        const parsed = JSON.parse(line) as WalletStreamLine;
        if (parsed.type === "progress") {
          onProgress?.(parsed);
        } else if (parsed.type === "result") {
          result = parsed.data;
        } else if (parsed.type === "fatal") {
          throw new Error(parsed.error);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (!result) {
    throw new Error("Stream ended without a result");
  }
  return result;
}

export function traceWallet(walletAddress: string): Promise<TraceFundFlowResponse> {
  return postJson<TraceFundFlowResponse>("/api/trace", { walletAddress });
}
