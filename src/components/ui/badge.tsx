import type { ReactNode } from "react";
import { cn } from "./cn";

export type BadgeVariant = "success" | "warning" | "danger" | "info" | "neutral";

const VARIANT_CLASS: Record<BadgeVariant, string> = {
  success: "bg-primary-soft text-primary-strong",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  neutral: "bg-muted text-ink-muted",
};

export function Badge({ variant = "neutral", children }: { variant?: BadgeVariant; children: ReactNode }) {
  return (
    <span className={cn("rounded-pill px-2.5 py-1 text-xs font-semibold", VARIANT_CLASS[variant])}>
      {children}
    </span>
  );
}
