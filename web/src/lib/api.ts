import type { ApiError, ProgressEvent, TraceFundFlowResponse, WalletAnalysisResponse } from "./types";

type StreamLine<T> =
  | ({ type: "progress" } & ProgressEvent)
  | { type: "result"; data: T }
  | { type: "fatal"; error: string };

/**
 * Both POST /api/wallet and POST /api/trace stream newline-delimited JSON (see
 * Routes/dataFetching.ts and Routes/traceFetching.ts) instead of one blocking response, since
 * either pipeline can take a while — each step is reported to `onProgress` as it happens, and the
 * final result resolves the returned promise. Line shapes: {"type":"progress",...ProgressEvent},
 * {"type":"result","data":T}, or {"type":"fatal","error":string}.
 */
async function streamNdjson<T>(
  path: string,
  body: unknown,
  onProgress?: (event: ProgressEvent) => void,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as ApiError | null;
    throw new Error(json?.error ?? `Request to ${path} failed (${res.status})`);
  }
  if (!res.body) {
    throw new Error("This browser does not support streaming responses");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: T | null = null;

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

        const parsed = JSON.parse(line) as StreamLine<T>;
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

export function analyzeWallet(
  walletAddress: string,
  onProgress?: (event: ProgressEvent) => void,
): Promise<WalletAnalysisResponse> {
  return streamNdjson<WalletAnalysisResponse>("/api/wallet", { walletAddress }, onProgress);
}

export function traceWallet(
  walletAddress: string,
  onProgress?: (event: ProgressEvent) => void,
): Promise<TraceFundFlowResponse> {
  return streamNdjson<TraceFundFlowResponse>("/api/trace", { walletAddress }, onProgress);
}
