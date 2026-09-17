import { getCurrentUser } from "@/lib/auth/get-current-user";
import { getOrderAktifIndicator, type OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";

// Everything the shared app header (AppHeader) needs: the Order Aktif
// indicator plus whether the owner-only menu entries show. Every page with a
// header calls this once per request. Hiding menu entries is UX only — the
// pages/actions behind them check the role themselves (CLAUDE.md
// "Server-side authorization").
export type HeaderNav = OrderAktifIndicator & { isOwner: boolean };

export async function getHeaderNav(): Promise<HeaderNav> {
  const [indicator, user] = await Promise.all([getOrderAktifIndicator(), getCurrentUser()]);
  return { ...indicator, isOwner: user?.role === "OWNER" };
}
