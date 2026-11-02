"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "motion/react";
import type { HeaderNav } from "@/lib/header/get-header-nav";
import type { IceCreamProduct } from "@/lib/stock/get-ice-cream";
import { LOW_STOCK_THRESHOLD } from "@/lib/stock/types";
import { AppHeader } from "@/components/ui/app-header";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PriceText } from "@/components/ui/price-text";
import { formatRupiah } from "@/lib/printing/format";
import { SelfUseSheet } from "./self-use-sheet";
import { CorrectionSheet, ProductFormSheet, RestockSheet } from "./stock-sheets";

type OpenSheet =
  | { kind: "selfUse" }
  | { kind: "restock" }
  | { kind: "correction" }
  | { kind: "product"; product: IceCreamProduct | null };

// Stok Es Krim (docs/spec-es-krim.md). Everyone sees the stock and can
// record "Ambil Sendiri" (the one primary action); the owner also gets
// Barang Masuk, Koreksi, product edit and per-product history.
export function IceCreamScreen({
  products,
  isOwner,
  nav,
}: {
  products: IceCreamProduct[];
  isOwner: boolean;
  nav: HeaderNav;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<OpenSheet | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const active = products.filter((p) => p.isActive);
  const inactive = products.filter((p) => !p.isActive);
  const totalPcs = active.reduce((sum, p) => sum + p.stock, 0);

  function done(message: string) {
    setSheet(null);
    setNotice(message);
    router.refresh();
  }

  function row(p: IceCreamProduct) {
    const stockTone =
      p.stock === 0 ? "text-danger" : p.stock <= LOW_STOCK_THRESHOLD ? "text-warning" : "text-ink";
    return (
      <div key={p.id} className="border-border flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-3 last:border-b-0">
        <div className="min-w-0 flex-1">
          <p className="text-ink text-base leading-tight font-bold">{p.name}</p>
          <p className="text-ink-muted text-sm">
            <PriceText amount={p.price} weight="secondary" />
            {isOwner && p.costPrice != null && <> · modal {formatRupiah(p.costPrice)}</>}
            {isOwner && p.unitsPerBox != null && p.boxPrice != null && (
              <> · {p.unitsPerBox}/box {formatRupiah(p.boxPrice)}</>
            )}
          </p>
        </div>
        <div className="text-right">
          <p className={`text-2xl leading-none font-bold tabular-nums ${stockTone}`}>{p.stock}</p>
          <p className="text-ink-faint text-xs">{p.stock === 0 ? "habis" : "pcs"}</p>
        </div>
        {isOwner && (
          <div className="flex w-full gap-2 sm:w-auto">
            <LinkButton href={`/es-krim/${p.id}`} variant="secondary" size="compact" className="flex-1 sm:flex-none">
              Riwayat
            </LinkButton>
            <Button
              variant="secondary"
              size="compact"
              className="flex-1 sm:flex-none"
              onClick={() => setSheet({ kind: "product", product: p })}
            >
              Edit
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-canvas flex h-dvh flex-col">
      <AppHeader nav={nav} title="Stok Es Krim" subtitle={`${active.length} produk · ${totalPcs} pcs`} />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          {notice && (
            <p role="status" className="bg-primary-soft text-primary-strong rounded-input px-3 py-2 text-sm font-medium">
              {notice}
            </p>
          )}

          <Button variant="primary" size="large" fullWidth onClick={() => setSheet({ kind: "selfUse" })} disabled={active.length === 0}>
            Ambil Sendiri (dimakan keluarga)
          </Button>

          {isOwner && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="default" onClick={() => setSheet({ kind: "restock" })} disabled={products.length === 0}>
                Barang Masuk
              </Button>
              <Button variant="secondary" size="default" onClick={() => setSheet({ kind: "correction" })} disabled={products.length === 0}>
                Koreksi Stok
              </Button>
            </div>
          )}

          <section className="flex flex-col gap-2">
            <h2 className="text-ink text-base font-bold">Stok sekarang</h2>
            <Card>
              {active.length === 0 ? (
                <p className="text-ink-faint px-4 py-6 text-center text-sm">Belum ada produk es krim aktif.</p>
              ) : (
                active.map(row)
              )}
            </Card>
          </section>

          {isOwner && (
            <>
              <Button variant="ghost" size="default" fullWidth onClick={() => setSheet({ kind: "product", product: null })}>
                + Produk Es Krim Baru
              </Button>
              {inactive.length > 0 && (
                <section className="flex flex-col gap-2">
                  <h2 className="text-ink-muted flex items-center gap-2 text-sm font-bold">
                    Nonaktif <Badge>tidak tampil di Kasir</Badge>
                  </h2>
                  <Card>{inactive.map(row)}</Card>
                </section>
              )}
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {sheet?.kind === "selfUse" && (
          <SelfUseSheet
            products={active.map((p) => ({ id: p.id, name: p.name, stock: p.stock }))}
            onClose={() => setSheet(null)}
            onDone={done}
          />
        )}
        {sheet?.kind === "restock" && <RestockSheet products={products} onClose={() => setSheet(null)} onDone={done} />}
        {sheet?.kind === "correction" && <CorrectionSheet products={products} onClose={() => setSheet(null)} onDone={done} />}
        {sheet?.kind === "product" && (
          <ProductFormSheet
            key={sheet.product?.id ?? "new"}
            product={sheet.product}
            onClose={() => setSheet(null)}
            onDone={done}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
