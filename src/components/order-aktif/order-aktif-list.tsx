"use client";

import { useRouter } from "next/navigation";
import type { ActiveOrder, UnpaidServedOrder } from "@/lib/orders/get-active-orders";
import { useNow } from "@/lib/use-now";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { ListRow } from "@/components/ui/list-row";
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
}: {
  orders: ActiveOrder[];
  unpaidServed: UnpaidServedOrder[];
  prepBaseMinutes: number;
  prepMinutesPerPortion: number;
}) {
  const router = useRouter();
  const now = useNow();

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <div className="border-border bg-surface flex items-center justify-between border-b px-3 py-2">
        <h1 className="text-lg font-bold text-ink">Order Aktif</h1>
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/pesanan-terjadwal" variant="secondary">Pesanan Terjadwal</LinkButton>
          <LinkButton href="/piutang" variant="secondary">Piutang</LinkButton>
          <LinkButton href="/shift/pengeluaran" variant="secondary">Pengeluaran</LinkButton>
          <LinkButton href="/shift/tutup" variant="secondary">Tutup Shift</LinkButton>
          <LinkButton href="/kasir" variant="secondary">Ke Kasir</LinkButton>
          <SignOutButton />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <Card>
          {orders.length === 0 ? (
            <p className="text-ink-faint py-12 text-center">Tidak ada order aktif.</p>
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
