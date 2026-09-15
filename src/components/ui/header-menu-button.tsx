"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { Sheet } from "./sheet";

// Collapses the less-frequently-tapped nav actions in a screen header into
// one button + bottom sheet, so the header stays a single row at tablet
// width (1180px landscape) instead of wrapping to two — see CLAUDE.md
// "Header satu baris" note. Closes itself on any tap inside (a nav link
// navigates away anyway; for an in-place action like sign-out, closing
// immediately still reads correctly since the page redirects right after).
export function HeaderMenuButton({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu lainnya"
        className="rounded-pill bg-muted flex h-12 items-center gap-1.5 px-4 text-sm font-semibold text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        Menu
      </button>
      <AnimatePresence>
        {open && (
          <Sheet title="Menu" onClose={() => setOpen(false)}>
            <div className="flex flex-col" onClick={() => setOpen(false)}>
              {children}
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
