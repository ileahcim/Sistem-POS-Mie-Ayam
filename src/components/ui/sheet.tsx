"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";
import { sheetPanelMotion, useSheetMotionPrefs } from "./sheet-motion";

// Shared bottom-sheet shell — backdrop fade + panel spring-in (slight
// scale + blur, see sheet-motion.tsx for the pattern and its reduced-motion
// / blur-toggle switches), a drag handle (GoFood-style), and
// header/body/footer slots. No layout-affecting properties are animated.
// AnimatePresence for the exit animation lives in the caller (it needs to
// keep the Sheet mounted during exit).
//
// `animated={false}` renders the exact same markup with no motion at all —
// used by the add-on sheet, where speed and hit-reliability beat polish
// (see addon-sheet.tsx for the whole story).
export function Sheet({
  title,
  onClose,
  children,
  footer,
  animated = true,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  animated?: boolean;
}) {
  const motionPrefs = useSheetMotionPrefs();
  const body = (
    <>
      <div className="flex justify-center pt-2">
        <div className="h-1 w-10 rounded-pill bg-border" aria-hidden />
      </div>
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <button type="button" onClick={onClose} className="h-10 w-10 shrink-0 text-2xl text-ink-muted" aria-label="Tutup">
          &#8592;
        </button>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>

      {footer && <div className="border-t border-border p-4">{footer}</div>}
    </>
  );

  const panelClassName =
    "rounded-sheet shadow-sheet fixed inset-x-0 bottom-0 z-50 flex max-h-[90vh] flex-col bg-surface";

  if (!animated) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
        <div className={panelClassName}>{body}</div>
      </>
    );
  }

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-black/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      />
      <motion.div
        className={panelClassName}
        style={{ transformOrigin: "bottom center" }}
        {...sheetPanelMotion(motionPrefs)}
      >
        {body}
      </motion.div>
    </>
  );
}
