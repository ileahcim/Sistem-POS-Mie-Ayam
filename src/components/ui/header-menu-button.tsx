"use client";

import { AnimatePresence } from "motion/react";
import type { ReactNode } from "react";
import { Sheet } from "./sheet";

// The app's navigation button (always top-left, see AppHeader) + its bottom
// sheet. Icon + "Menu" label; on a phone-width screen the label is dropped so
// the header row still fits.
//
// `open`/`onOpen`/`onClose` are lifted into the caller (MainMenu) rather than
// owned here, specifically so MainMenu can wire `onClose` directly onto each
// nav Link's own `onClick` (the exact click that triggers Next's navigation),
// instead of relying on it bubbling up through nested motion.div gesture
// wrappers to a single ancestor handler. `children` MUST stay a plain
// ReactNode, never a render-prop function — this component (via AppHeader)
// gets rendered from server-only screens too (e.g. HppScreen), and passing a
// function as JSX children breaks React Server Components' serialization
// ("Functions are not valid as a child of Client Components") even though
// the function itself only ever runs client-side. Found by testing /admin/hpp
// after an earlier render-prop version of this file, 22 Sep 2026.
export function HeaderMenuButton({
  open,
  onOpen,
  onClose,
  children,
}: {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onOpen}
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
          <Sheet title="Menu" onClose={onClose}>
            {/* Catch-all for children that don't wire onClose themselves
                (e.g. the sign-out button below) — nav rows wire it directly
                onto their Link's own onClick instead of relying on this. */}
            <div className="flex flex-col" onClick={onClose}>
              {children}
            </div>
          </Sheet>
        )}
      </AnimatePresence>
    </>
  );
}
