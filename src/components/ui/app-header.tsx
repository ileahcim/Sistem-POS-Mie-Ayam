import type { ReactNode } from "react";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { MainMenu } from "./main-menu";
import { OrderAktifButton } from "./order-aktif-button";
import { LateOrderBanner } from "./late-order-banner";

// The one header used by every screen: Menu (top-left, same entries
// everywhere), the page title, then page-specific actions and the Order
// Aktif button on the right — one solid surface with one bottom border.
// Server-renderable (no "use client"); the interactive pieces are client
// components rendered inside it.
export function AppHeader({
  nav,
  title,
  subtitle,
  actions,
  lateCount,
  showOrderAktif = true,
}: {
  nav: HeaderNav;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  // Order Aktif computes its own live count instead of the per-request one.
  lateCount?: number;
  showOrderAktif?: boolean;
}) {
  return (
    <>
      <LateOrderBanner lateCount={lateCount ?? nav.lateCount} />
      <header className="border-border bg-surface flex items-center gap-2 border-b px-3 py-2">
        <MainMenu isOwner={nav.isOwner} />
        <div className="min-w-0 flex-1">
          <h1 className="text-ink line-clamp-2 text-base leading-tight font-bold break-words sm:text-lg">{title}</h1>
          {subtitle && <div className="text-ink-muted truncate text-sm">{subtitle}</div>}
        </div>
        {(actions || showOrderAktif) && (
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {showOrderAktif && <OrderAktifButton activeCount={nav.activeCount} lateCount={nav.lateCount} />}
          </div>
        )}
      </header>
    </>
  );
}
