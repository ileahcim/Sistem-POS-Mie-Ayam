import { cn } from "@/components/ui/cn";

// "Bekukan harga" (26 Sep 2026): the price of a new pesanan/pengambilan that
// came from a price the owner already set (harga khusus, harga umum, harga
// pasar, or the customer's last price) is shown LOCKED, not as an input — a
// stray tap can't change it. The form puts an "Ubah harga" button next to
// the note under it; only that turns this back into the normal input.
export function LockedPrice({ value, unit }: { value: number | ""; unit: "kg" | "pcs" }) {
  return (
    <div
      data-testid="price-locked"
      aria-label={value === "" ? "Memuat harga" : `Harga per ${unit} Rp${value.toLocaleString("id-ID")}, terkunci`}
      className={cn(
        "rounded-input border-border bg-muted text-ink flex h-12 items-center gap-1 border px-3 text-base font-semibold tabular-nums",
        value === "" && "text-ink-faint",
      )}
    >
      <span aria-hidden className="text-ink-faint text-sm">
        🔒
      </span>
      <span className="truncate">{value === "" ? "…" : `Rp${value.toLocaleString("id-ID")}`}</span>
    </div>
  );
}
