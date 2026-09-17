import type { MieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import type { OrderAktifIndicator } from "@/lib/orders/get-order-aktif-indicator";
import { MIE_FIXED_PRODUCT_TYPES, MIE_PRODUCT_LABEL } from "@/lib/mie/types";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { OrderAktifButton } from "@/components/ui/order-aktif-button";
import { LateOrderBanner } from "@/components/ui/late-order-banner";
import { MieProductDefaultRow } from "./mie-product-default-row";

// Server-renderable shell, same split as HppScreen/HppItemRow — only the
// per-row editor needs "use client". CUSTOM has no row here: a request
// khusus is priced fresh every time, never remembered as a default.
export function ProductDefaultsScreen({
  defaults,
  orderAktifIndicator,
}: {
  defaults: MieProductDefaults;
  orderAktifIndicator: OrderAktifIndicator;
}) {
  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <LateOrderBanner lateCount={orderAktifIndicator.lateCount} />
      <div className="border-border bg-surface flex items-center justify-between border-b px-4 py-3">
        <h1 className="text-lg font-bold text-ink">Harga Produk Mi Mentah</h1>
        <div className="flex items-center gap-2">
          <OrderAktifButton activeCount={orderAktifIndicator.activeCount} lateCount={orderAktifIndicator.lateCount} />
          <LinkButton href="/note" variant="secondary">
            Kembali
          </LinkButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-3">
          <p className="text-ink-muted text-sm">
            Harga default per kg — dipakai sebagai saran awal saat membuat pesanan baru, tapi tetap bisa diubah per
            pelanggan saat itu juga.
          </p>
          <Card>
            {MIE_FIXED_PRODUCT_TYPES.map((type) => (
              <MieProductDefaultRow
                key={type}
                productType={type}
                label={MIE_PRODUCT_LABEL[type]}
                defaultPricePerKg={defaults[type]}
              />
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
