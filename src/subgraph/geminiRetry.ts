// Retries a Gemini call when it's rate-limited (HTTP 429), honoring the delay Gemini itself
// suggests in the error body's RetryInfo detail (a few seconds to under a minute in practice —
// this is a rolling per-minute/burst limit, not "come back tomorrow": the free tier's daily quota
// error reuses the same 429/RESOURCE_EXHAUSTED shape but with a short, shrinking retryDelay, so
// actually waiting it out and retrying works far more often than treating the first 429 as final.

import { RateLimitError } from 'openai';

// 3, not 2: a per-minute limit's suggested retryDelay is only accurate for a single isolated
// call. When several calls burst in quick succession (e.g. a multi-round tool-calling loop), the
// rolling window can still contain earlier calls from that same burst by the time the first retry
// fires — an extra attempt gives the window more real time to actually clear.
const MAX_RETRIES = 3;
const DEFAULT_WAIT_MS = 5000;
const WAIT_BUFFER_MS = 3000;

interface GoogleErrorDetail {
  ['@type']?: string;
  retryDelay?: string;
}

function extractRetryDelayMs(err: RateLimitError): number {
  const details = (err.error as { details?: unknown[] } | null | undefined)?.details;
  if (Array.isArray(details)) {
    for (const entry of details as GoogleErrorDetail[]) {
      if (entry?.['@type']?.includes('RetryInfo') && typeof entry.retryDelay === 'string') {
        const match = /^(\d+(?:\.\d+)?)s$/.exec(entry.retryDelay);
        if (match) return Math.ceil(parseFloat(match[1]) * 1000);
      }
    }
  }
  return DEFAULT_WAIT_MS;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying up to MAX_RETRIES times if it throws a 429 RateLimitError — waiting the
 * delay Gemini's own error response suggests (plus a small buffer) between attempts. `onWait`
 * (optional) is called before each wait so callers can surface it as a progress checkpoint.
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>, onWait?: (waitMs: number, attempt: number) => void): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof RateLimitError) || attempt >= MAX_RETRIES) throw err;
      const waitMs = extractRetryDelayMs(err) + WAIT_BUFFER_MS;
      onWait?.(waitMs, attempt + 1);
      await sleep(waitMs);
    }
  }
}
