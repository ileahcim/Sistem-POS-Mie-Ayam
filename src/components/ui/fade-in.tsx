"use client";

import type { ReactNode } from "react";
import { motion } from "motion/react";

// Entrance transition for Dashboard sections only (CLAUDE.md "Animasi" —
// this is a sit-down report screen, unlike Kasir/Order Aktif where
// category/product taps must stay instant). A Server Component can render
// this around Server Component children directly — only this wrapper
// needs "use client", the sections passed in don't.
export function FadeIn({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
