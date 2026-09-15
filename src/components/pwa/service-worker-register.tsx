"use client";

import { useEffect } from "react";

// Mounted once in the root layout — registers public/sw.js on every page.
// Best-effort only: a failed/unsupported registration must never break the
// app itself (older Android WebViews, private browsing, etc. all handle
// this fine by just not getting the offline fallback).
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  return null;
}
