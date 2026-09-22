"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence } from "motion/react";
import { Sheet } from "./sheet";

// The app's navigation button (always top-left, see AppHeader) + its
// bottom sheet. Icon + "Menu" label; on a phone-width screen the label is
// dropped so the header row still fits. Closes itself on any tap inside (a nav link
// navigates away anyway; for an in-place action like sign-out, closing
// immediately still reads correctly since the page redirects right after).
// The wrapper's onClick below is a catch-all for children that don't wire
// `close` themselves (e.g. the sign-out button); nav rows (MainMenu) call
// the `close` passed to them directly off the SAME onClick that triggers
// the Link's navigation, instead of relying on this bubbling up through
// nested motion.div gesture wrappers.
export function HeaderMenuButton({ children }: { children: ReactNode | ((close: () => void) => ReactNode) }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Menu"
        className="rounded-pill bg-muted flex h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 px-3 text-sm font-semibold text-ink sm:px-4"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
          <path d="M2.5 5h13M2.5 9h13M2.5 13h13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Menu</span>
      </button>
      <AnimatePresence>
        {open && (
          <Sheet title="Menu" onClose={close}>
            <div className="flex flex-col" onClick={close}>
              {typeof children === "function" ? children(close) : children}
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
