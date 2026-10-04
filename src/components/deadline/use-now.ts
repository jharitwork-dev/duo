'use client';

import { useCallback, useMemo, useSyncExternalStore } from 'react';

/**
 * One shared ticker per interval. `current` is only refreshed while subscribed, and is refreshed
 * immediately on subscribe so a late-mounting component never sees a stale clock.
 */
interface Ticker {
  current: number;
  listeners: Set<() => void>;
  timer: ReturnType<typeof setInterval> | null;
}

const tickers = new Map<number, Ticker>();

function getTicker(intervalMs: number): Ticker {
  let t = tickers.get(intervalMs);
  if (!t) {
    t = { current: Date.now(), listeners: new Set(), timer: null };
    tickers.set(intervalMs, t);
  }
  return t;
}

function subscribe(intervalMs: number, listener: () => void): () => void {
  const t = getTicker(intervalMs);
  t.listeners.add(listener);
  if (!t.timer) {
    t.current = Date.now();
    t.timer = setInterval(() => {
      t.current = Date.now();
      t.listeners.forEach((l) => l());
    }, intervalMs);
    // The value may have moved since the last tick: tell subscribers to re-read it.
    queueMicrotask(() => t.listeners.forEach((l) => l()));
  }
  return () => {
    t.listeners.delete(listener);
    if (t.listeners.size === 0 && t.timer) {
      clearInterval(t.timer);
      t.timer = null;
    }
  };
}

/**
 * Live clock for deadline UI (261004-03i). The server render and hydration use `serverNowIso`
 * (getServerSnapshot), so markup matches; after hydration it switches to the browser clock and
 * re-renders every `intervalMs`.
 */
export function useNow(serverNowIso: string, intervalMs = 60_000): Date {
  // Stable subscribe/getSnapshot: a new identity per render would resubscribe (and reset the ticker).
  const sub = useCallback((listener: () => void) => subscribe(intervalMs, listener), [intervalMs]);
  const snap = useCallback(() => getTicker(intervalMs).current, [intervalMs]);
  const ms = useSyncExternalStore(
    sub,
    snap,
    () => Date.parse(serverNowIso),
  );
  return useMemo(() => new Date(ms), [ms]);
}
