"use client";

import { useEffect, useState } from "react";

// Ticks slowly on purpose — this only drives a "N mnt" label, not a
// stopwatch, and cheap tablets shouldn't re-render every second for that.
export function useNow(intervalMs = 15000): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
