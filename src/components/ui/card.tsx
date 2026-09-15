import type { ReactNode } from "react";
import { cn } from "./cn";

// The base "grouping" primitive — a white surface on the gray canvas
// background. Anything that needs to read as one visual unit (an order's
// item list, a form section) belongs inside a Card, not floating directly
// on the page background.
export function Card({ children, className, padded = false }: { children: ReactNode; className?: string; padded?: boolean }) {
  return (
    <div className={cn("rounded-card bg-surface shadow-card border border-border", padded && "p-4", className)}>
      {children}
    </div>
  );
}
