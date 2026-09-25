import type { MieProductDefaults } from "@/lib/mie/get-mie-product-defaults";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import { MIE_COST_ROWS, MIE_FIXED_PRODUCT_TYPES, MIE_PASAR_PRODUCT_TYPE, MIE_PRODUCT_LABEL, type MieCosts } from "@/lib/mie/types";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/ui/app-header";
import { MieProductDefaultRow } from "./mie-product-default-row";

// Server-renderable shell, same split as HppScreen/HppItemRow — only the
// per-row editor needs "use client". CUSTOM has no row here: a request
// khusus is priced fresh every time, never remembered as a default.
export function ProductDefaultsScreen({
  defaults,
  pasarPricePerKg,
  frozenPricePerPcs,
  costs,
  nav,
}: {
  costs: MieCosts;
  defaults: MieProductDefaults;
  pasarPricePerKg: number | null;
  frozenPricePerPcs: number | null;
  nav: HeaderNav;
}) {
  const missingCosts = MIE_COST_ROWS.filter((r) => costs[r.key] == null).length;

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader
        nav={nav}
        title="Harga Mi Mentah"
        actions={
          <LinkButton href="/note" variant="secondary" size="compact">
            Kembali
          </LinkButton>
        }
      />

      {missingCosts > 0 && (
        <div className="border-border bg-surface border-b px-4 py-3 text-sm">
          <p className="text-warning font-medium">
            {missingCosts} modal per kg belum diisi — pesanan jenis itu tidak dihitung marginnya di Ringkasan.
          </p>
        </div>
      )}

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
                target={{ kind: "default", productType: type }}
                label={MIE_PRODUCT_LABEL[type]}
                defaultPricePerKg={defaults[type]}
              />
            ))}
          </Card>
          <p className="text-ink-muted mt-2 text-sm">
            Harga shortcut di form pesanan baru — harga pasar sering berubah, ubah di sini kapan saja.
          </p>
          <Card>
            <MieProductDefaultRow
              target={{ kind: "pasar" }}
              label="Mie Pasar"
              hint={`${MIE_PRODUCT_LABEL[MIE_PASAR_PRODUCT_TYPE]} · tombol "Mie Pasar" di form pesanan`}
              defaultPricePerKg={pasarPricePerKg}
            />
          </Card>

          <p className="text-ink-muted mt-2 text-sm">
            Modal per kg bahan baku — angka tetap yang jarang berubah (bukan harga jual). Dipakai menghitung Margin di
            Ringkasan: (harga jual per kg pesanan itu − modal per kg) × kg. Mi Pasar punya modal sendiri karena
            resepnya beda.
          </p>
          <Card>
            {MIE_COST_ROWS.map((row) => (
              <MieProductDefaultRow
                key={row.key}
                target={{ kind: "cost", key: row.key }}
                label={row.label}
                defaultPricePerKg={costs[row.key]}
              />
            ))}
          </Card>

          <p className="text-ink-muted mt-2 text-sm">
            Harga default Buku Frozen (per pcs) — dipakai sebagai saran awal di form pengambilan, tetap bisa diubah
            per pelanggan saat itu juga.
          </p>
          <Card>
            <MieProductDefaultRow
              target={{ kind: "frozenPrice" }}
              label="Frozen"
              hint="Harga per pcs — form Pengambilan Frozen"
              defaultPricePerKg={frozenPricePerPcs}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
