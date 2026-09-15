"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { cn } from "./cn";

const MotionLink = motion.create(Link);

// The shell for one row in a list of items/orders — consistent padding and
// divider so every list in the app has the same rhythm, instead of each
// screen picking its own py-2/py-3/py-4 ad hoc. Rows needing more breathing
// room (an order line with an addon sub-line) pass `roomy`. Pass either
// `onClick` (an in-page action) or `asLink` (real navigation, so the
// browser's link semantics/prefetch still work) — not both.
export function ListRow({
  children,
  onClick,
  asLink,
  roomy = false,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  asLink?: string;
  roomy?: boolean;
  className?: string;
}) {
  const padding = roomy ? "py-4" : "py-3";
  const shared = cn(
    "flex w-full items-center gap-3 border-b border-border px-4 text-left last:border-b-0",
    padding,
    className,
  );

  if (asLink) {
    return (
      <MotionLink href={asLink} whileTap={{ scale: 0.99 }} transition={{ duration: 0.12 }} className={shared}>
        {children}
      </MotionLink>
    );
  }

  if (onClick) {
    return (
      <motion.button
        type="button"
        onClick={onClick}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.12 }}
        className={shared}
      >
        {children}
      </motion.button>
    );
  }

  return <div className={cn("flex items-center gap-3 border-b border-border px-4 last:border-b-0", padding, className)}>{children}</div>;
}
