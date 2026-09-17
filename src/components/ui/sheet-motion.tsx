"use client";

import { createContext, useContext, type ReactNode } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";

// Shared animation pattern for sheets/popups (Menu, add-on, konfirmasi,
// Pisahkan & Bayar): the container springs in with a slight scale + blur,
// items inside stagger in, and tappable items get a hover tint + tap
// shrink. Two switches keep it safe on the real tablet:
// - prefers-reduced-motion: no movement and no blur at all, a short fade only.
// - Setting.sheetBlurEnabled (owner toggle in /admin/settings): drops only
//   the blur (the GPU-heavy part), keeps the spring/stagger.
// The product grid and product taps never use any of this (CLAUDE.md
// "Animasi" — those stay instant).

const SheetBlurContext = createContext(true);

export function SheetMotionProvider({ blurEnabled, children }: { blurEnabled: boolean; children: ReactNode }) {
  return <SheetBlurContext.Provider value={blurEnabled}>{children}</SheetBlurContext.Provider>;
}

type SheetMotionPrefs = { reduced: boolean; blur: boolean };

export function useSheetMotionPrefs(): SheetMotionPrefs {
  const reduced = useReducedMotion() ?? false;
  const blurEnabled = useContext(SheetBlurContext);
  return { reduced, blur: blurEnabled && !reduced };
}

const SPRING: Transition = { type: "spring", duration: 0.55, bounce: 0.2 };
// Opacity/blur must not overshoot (a bouncing blur goes negative = invalid
// CSS for a frame), so they get the same timing without the bounce.
const SPRING_NO_BOUNCE: Transition = { type: "spring", duration: 0.55, bounce: 0 };
const REDUCED_FADE: Transition = { duration: 0.15 };

const BLURRED = "blur(10px)";
const SHARP = "blur(0px)";

export function sheetPanelMotion({ reduced, blur }: SheetMotionPrefs) {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: REDUCED_FADE,
    };
  }
  const hidden = { y: -5, scale: 0.95, opacity: 0, ...(blur && { filter: BLURRED }) };
  return {
    initial: hidden,
    animate: { y: 0, scale: 1, opacity: 1, ...(blur && { filter: SHARP }) },
    exit: hidden,
    transition: { ...SPRING, opacity: SPRING_NO_BOUNCE, filter: SPRING_NO_BOUNCE },
  };
}

export function sheetItemMotion({ reduced, blur }: SheetMotionPrefs, index: number) {
  if (reduced) {
    return { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: REDUCED_FADE };
  }
  const delay = index * 0.08;
  return {
    initial: { opacity: 0, x: 10, scale: 0.95, ...(blur && { filter: BLURRED }) },
    animate: { opacity: 1, x: 0, scale: 1, ...(blur && { filter: SHARP }) },
    transition: {
      ...SPRING,
      delay,
      opacity: { ...SPRING_NO_BOUNCE, delay },
      filter: { ...SPRING_NO_BOUNCE, delay },
    },
  };
}

// Tap/hover feedback for one item. Kept on its own element (not the
// staggered wrapper) so releasing a tap springs back immediately instead of
// re-waiting the stagger delay. The hover tint is an overlay, so the item's
// own background (selected chip, highlighted card) is never overwritten.
export const ITEM_TAP = { scale: 0.95, transition: { duration: 0.2 } };

export function HoverTint() {
  return (
    <motion.span
      aria-hidden
      className="bg-ink/5 pointer-events-none absolute inset-0 rounded-[inherit]"
      initial={{ opacity: 0 }}
      variants={{ hover: { opacity: 1 } }}
      transition={{ duration: 0.4 }}
    />
  );
}

// Staggered item wrapper. `interactive` adds the tap shrink + hover tint
// around the children (for rows/cards that are themselves tappable).
export function SheetItem({
  index,
  interactive = false,
  className,
  children,
}: {
  index: number;
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const prefs = useSheetMotionPrefs();
  return (
    <motion.div {...sheetItemMotion(prefs, index)} className={className}>
      {interactive ? (
        <motion.div
          className="relative overflow-hidden rounded-[inherit]"
          whileHover="hover"
          whileTap={prefs.reduced ? undefined : ITEM_TAP}
        >
          {children}
          <HoverTint />
        </motion.div>
      ) : (
        children
      )}
    </motion.div>
  );
}

