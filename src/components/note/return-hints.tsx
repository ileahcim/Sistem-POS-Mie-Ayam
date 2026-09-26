import { formatNoteReturnWindow, type NoteReturnContext } from "@/lib/note/return-window";
import { formatId } from "@/lib/timezone";

function formatQty(qty: number, unit: "kg" | "pcs"): string {
  return `${(Math.round(qty * 100) / 100).toLocaleString("id-ID")} ${unit}`;
}

function formatDayShort(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return formatId(new Date(Date.UTC(y, m - 1, d, 5)), { day: "numeric", month: "short" });
}

// Retur form & retur edit sheet, both books: a retur bigger than what the
// customer ordered of that item in the retur's window (NOTE_RETURN_WINDOW_DAYS)
// is most likely a typo. Shown as a warning; saving stays possible.
export function ReturnQtyWarning({
  qty,
  unit,
  context,
  itemLabel,
  customerName,
}: {
  qty: number;
  unit: "kg" | "pcs";
  context: NoteReturnContext | null;
  itemLabel: string; // already phrased: "pesanan Mi Pasar", "pengambilan"
  customerName: string;
}) {
  if (!context || !(qty > context.windowQty)) return null;
  const when = formatNoteReturnWindow(context.fromDay, context.toDay);
  return (
    <p role="status" data-testid="return-warning" className="bg-warning-soft text-warning rounded-card px-3 py-2 text-sm font-medium">
      {context.windowQty === 0
        ? `Tidak ada ${itemLabel} ${customerName} tanggal ${when}. Periksa lagi sebelum menyimpan.`
        : `Retur ${formatQty(qty, unit)} lebih banyak dari ${itemLabel} ${customerName} tanggal ${when} (${formatQty(context.windowQty, unit)}). Mungkin salah ketik — periksa lagi.`}
    </p>
  );
}

// Where the suggested harga came from: the customer's last order of that item.
export function ReturnPriceHint({
  context,
  itemLabel,
  customerName,
  unit,
}: {
  context: NoteReturnContext | null;
  itemLabel: string;
  customerName: string;
  unit: "kg" | "pcs";
}) {
  if (!context) return null;
  return (
    <p className="text-ink-muted text-sm" data-testid="return-price-hint">
      {context.lastPrice != null && context.lastPriceDay
        ? `Harga ${itemLabel} terakhir ${customerName} (${formatDayShort(context.lastPriceDay)}).`
        : `Belum ada ${itemLabel} ${customerName} sebelumnya — isi harga/${unit} sendiri.`}
    </p>
  );
}
