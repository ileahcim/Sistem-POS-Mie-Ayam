import type { ReactNode } from "react";
import { LinkButton } from "./link-button";

// Shared "nothing here yet" treatment for list screens (Order Aktif,
// Piutang, Pesanan Terjadwal, Pengeluaran) — an icon + a plain-language
// sentence + an optional way back to Kasir, instead of a bare gray line of
// text on white. Server-renderable (LinkButton doesn't need "use client").
export function EmptyState({
  icon,
  title,
  description,
  actionHref,
  actionLabel,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <div className="text-ink-faint mb-1" aria-hidden>
        {icon}
      </div>
      <p className="text-ink text-base font-semibold">{title}</p>
      {description && <p className="text-ink-muted max-w-xs text-sm">{description}</p>}
      {actionHref && actionLabel && (
        <LinkButton href={actionHref} variant="primary" className="mt-3">
          {actionLabel}
        </LinkButton>
      )}
    </div>
  );
}
