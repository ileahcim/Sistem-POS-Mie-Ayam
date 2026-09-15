"use client";

import { useRouter } from "next/navigation";
import type { ActiveOrder, UnpaidServedOrder } from "@/lib/orders/get-active-orders";
import { useNow } from "@/lib/use-now";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
import { HeaderMenuButton } from "@/components/ui/header-menu-button";
import { EmptyState } from "@/components/ui/empty-state";
import { NoOrdersIcon } from "@/components/ui/empty-state-icons";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { OrderRow } from "./order-row";

const CHANNEL_LABEL: Record<UnpaidServedOrder["channel"], string> = {
  DINE_IN: "",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

export function OrderAktifList({
  orders,
  unpaidServed,
  prepBaseMinutes,
  prepMinutesPerPortion,
  isOwner,
}: {
  orders: ActiveOrder[];
  unpaidServed: UnpaidServedOrder[];
  prepBaseMinutes: number;
  prepMinutesPerPortion: number;
  isOwner: boolean;
}) {
  const router = useRouter();
  const now = useNow();

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <div className="border-border bg-surface flex items-center justify-between border-b px-3 py-2">
        <h1 className="text-lg font-bold text-ink">Order Aktif</h1>
        <div className="flex items-center gap-2">
          <LinkButton href="/kasir" variant="primary">Ke Kasir</LinkButton>
          <HeaderMenuButton>
            {isOwner && (
              <ListRow asLink="/dashboard">
                <span className="text-base font-semibold text-ink">Dashboard</span>
              </ListRow>
            )}
            <ListRow asLink="/pesanan-terjadwal">
              <span className="text-base font-semibold text-ink">Pesanan Terjadwal</span>
            </ListRow>
            <ListRow asLink="/piutang">
              <span className="text-base font-semibold text-ink">Piutang</span>
            </ListRow>
            <ListRow asLink="/shift/pengeluaran">
              <span className="text-base font-semibold text-ink">Pengeluaran</span>
            </ListRow>
            <div className="pt-3">
              <SignOutButton />
            </div>
          </HeaderMenuButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <Card>
          {orders.length === 0 ? (
            <EmptyState
              icon={<NoOrdersIcon />}
              title="Belum ada order aktif"
              description="Order yang dibuat di Kasir akan muncul di sini sampai selesai dibayar."
              actionHref="/kasir"
              actionLabel="Ke Kasir"
            />
          ) : (
            orders.map((order) => (
              <OrderRow
                key={order.id}
                order={order}
                now={now}
                prepBaseMinutes={prepBaseMinutes}
                prepMinutesPerPortion={prepMinutesPerPortion}
                onTap={() => router.push(`/order-aktif/${order.id}`)}
              />
            ))
          )}
        </Card>

        {unpaidServed.length > 0 && (
          <div className="mt-3">
            <h2 className="text-ink-muted mb-1.5 text-sm font-bold uppercase tracking-wide">
              Sudah Disajikan · Menunggu Bayar
            </h2>
            <Card>
              {unpaidServed.map((order) => (
                <ListRow key={order.id} onClick={() => router.push(`/order-aktif/${order.id}`)} dense>
                  <span className="w-12 shrink-0 text-lg font-bold text-ink">
                    {order.queueNumber != null ? `#${order.queueNumber}` : "—"}
                  </span>
                  <span className="text-ink flex-1 text-sm font-semibold">
                    {order.channel === "DINE_IN" ? order.tableLabel : CHANNEL_LABEL[order.channel]}
                  </span>
                </ListRow>
              ))}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
