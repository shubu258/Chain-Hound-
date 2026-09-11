// Retries a Gemini call when it's rate-limited (HTTP 429) — but only when retrying can plausibly
// help. Google's free tier enforces two different 429s under the identical RESOURCE_EXHAUSTED
// shape: a rolling per-MINUTE burst limit (clears within roughly a minute — worth waiting out)
// and a per-DAY limit (does not reset again until the next UTC-ish day boundary — no amount of
// waiting a few seconds fixes that). The quotaId in the error body tells them apart; retrying the
// daily one just makes the caller wait through guaranteed-failing attempts for nothing.

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

interface GoogleQuotaViolation {
  quotaId?: string;
}

function getViolations(err: RateLimitError): GoogleQuotaViolation[] {
  const details = (err.error as { details?: unknown[] } | null | undefined)?.details;
  if (!Array.isArray(details)) return [];
  const failure = details.find(
    (d): d is { violations?: GoogleQuotaViolation[] } =>
      typeof d === 'object' && d !== null && (d as { ['@type']?: string })['@type']?.includes('QuotaFailure') === true,
  );
  return failure?.violations ?? [];
}

/** True when the 429 is a per-day quota, not a per-minute burst limit — retrying can't help. */
function isDailyQuotaError(err: RateLimitError): boolean {
  return getViolations(err).some((v) => typeof v.quotaId === 'string' && /PerDay/i.test(v.quotaId));
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
 * Runs `fn`, retrying up to MAX_RETRIES times if it throws a 429 RateLimitError caused by the
 * per-minute burst limit — waiting the delay Gemini's own error response suggests (plus a small
 * buffer) between attempts. A 429 from the per-day quota is rethrown immediately instead (see
 * isDailyQuotaError), since no amount of waiting fixes that within the same request. `onWait`
 * (optional) is called before each wait so callers can surface it as a progress checkpoint.
 */
export async function withGeminiRetry<T>(fn: () => Promise<T>, onWait?: (waitMs: number, attempt: number) => void): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof RateLimitError) || isDailyQuotaError(err) || attempt >= MAX_RETRIES) throw err;
      const waitMs = extractRetryDelayMs(err) + WAIT_BUFFER_MS;
      onWait?.(waitMs, attempt + 1);
      await sleep(waitMs);
    }
  }
}
