"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./button";

// "Isian belum disimpan" guard for a form page (Note Pesanan Baru, 2 Nov
// 2026). While `dirty`, every way out asks first:
//   - links (the form's Batal, the header menu, anything else on the page):
//     a capture-phase click listener on the document stops the click before
//     Next's <Link> sees it, then shows the dialog;
//   - the browser/Android Back button: one extra history entry (same URL) is
//     pushed the first time the form gets dirty, so Back lands on it instead
//     of leaving — the popstate then shows the dialog;
//   - reload / closing the tab: the browser's own beforeunload prompt.
// After saving, navigate with `leaveTo(href)` — it replaces the extra history
// entry instead of stacking a new one, so Back from the next page still lands
// on the page before the form's own entry, as without the guard.
const GUARD_KEY = "__unsavedGuard";

export function useUnsavedChangesGuard(dirty: boolean) {
  const router = useRouter();
  const dirtyRef = useRef(dirty);
  const releasedRef = useRef(false);
  const guardPushedRef = useRef(false);
  // Where "Ya, tinggalkan" goes: a link's href, or "back" (the Back button).
  const [pending, setPending] = useState<string | "back" | null>(null);

  useEffect(() => {
    dirtyRef.current = dirty;
    if (dirty && !guardPushedRef.current) {
      guardPushedRef.current = true;
      window.history.pushState({ [GUARD_KEY]: true }, "");
    }
  }, [dirty]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!dirtyRef.current || releasedRef.current || e.defaultPrevented) return;
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(url.pathname + url.search + url.hash);
    }
    function onPopState(e: PopStateEvent) {
      if (releasedRef.current || !guardPushedRef.current) return;
      // Back from the guard entry onto the form's own entry.
      if (e.state?.[GUARD_KEY]) return;
      guardPushedRef.current = false;
      if (!dirtyRef.current) {
        releasedRef.current = true;
        window.history.back();
        return;
      }
      setPending("back");
    }
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirtyRef.current || releasedRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const leaveTo = useCallback(
    (href: string) => {
      releasedRef.current = true;
      if (guardPushedRef.current) router.replace(href);
      else router.push(href);
    },
    [router],
  );

  function stay() {
    if (pending === "back" && !guardPushedRef.current) {
      // Put the guard back so the next Back asks again.
      guardPushedRef.current = true;
      window.history.pushState({ [GUARD_KEY]: true }, "");
    }
    setPending(null);
  }

  function leave() {
    const target = pending;
    setPending(null);
    if (target === "back") {
      releasedRef.current = true;
      window.history.back();
    } else if (target) leaveTo(target);
  }

  const dialog = pending ? (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true">
      <div className="rounded-card bg-surface shadow-sheet flex w-full max-w-sm flex-col items-center gap-4 p-6 text-center">
        <div>
          <p className="text-ink text-lg font-bold">Isian belum disimpan</p>
          <p className="text-ink-muted mt-1 text-sm">Kalau keluar sekarang, isian di form ini hilang.</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button variant="primary" size="large" fullWidth onClick={stay}>
            Lanjut isi
          </Button>
          <Button variant="danger" fullWidth onClick={leave}>
            Ya, tinggalkan
          </Button>
        </div>
      </div>
    </div>
  ) : null;

  return { dialog, leaveTo };
}
