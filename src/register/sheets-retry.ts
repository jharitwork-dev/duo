// Retry a Google Sheets API call on transient failures (429 rate-limit, 5xx).
// Copied from Cocoon pattern — exponential backoff + jitter.

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function statusOf(err: unknown): number {
  const e = err as {
    response?: { status?: number };
    code?: number | string;
    status?: number;
  };
  return Number(e?.response?.status ?? e?.code ?? e?.status ?? 0);
}

export async function withSheetsRetry<T>(
  fn: () => Promise<T>,
  { retries = 4, baseMs = 300 }: { retries?: number; baseMs?: number } = {},
): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      const status = statusOf(err);
      const retryable = status === 429 || (status >= 500 && status < 600);
      if (!retryable || attempt >= retries) throw err;
      const backoff = baseMs * 2 ** attempt + Math.floor(Math.random() * 250);
      console.warn(
        `[duo] Sheets ${status} — retry ${attempt + 1}/${retries} in ${backoff}ms`,
      );
      await sleep(backoff);
      attempt++;
    }
  }
}
