import type { PackingListData } from "@/lib/printing/types";
import { paperRule } from "@/lib/printing/paper";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";
import { ReceiptHeader, MetaRow } from "./receipt-meta";

function formatTanggal(date: Date): string {
  return formatId(date, { day: "numeric", month: "short", year: "numeric" });
}

function formatJam(date: Date): string {
  return formatId(date, { hour: "2-digit", minute: "2-digit", hour12: false });
}

// Same literal-character rule as ReceiptView (see that file's comment and
// src/lib/printing/paper.ts) — kept consistent so the two printouts read as
// the same "brand" of receipt even though this one has no prices.
function Rule() {
  return <div className="my-1.5 overflow-hidden text-[9px] leading-none whitespace-pre">{paperRule("=")}</div>;
}

// Packing checklist for Antar, printed before payment — no prices, no
// total. Checkbox glyph on the left (Richeese-Factory style), qty printed
// larger than the rest of the line since that's the number staff actually
// scan while assembling the order.
export function PackingListView({ data }: { data: PackingListData }) {
  return (
    <div className="mx-auto w-[320px] bg-white p-4 font-mono text-[13px] leading-relaxed text-black">
      <ReceiptHeader storeName={data.storeName} address={data.address} phone={data.phone} />
      <div className="mt-1 text-center font-bold">DAFTAR PACKING</div>

      <Rule />

      <div className="flex flex-col">
        <MetaRow label="No. Order" value={String(data.orderNumber)} />
        <MetaRow
          label="Antrian"
          value={data.queueNumber != null ? formatQueueLabel(data.queueNumber, data.queueSuffix) : "Belum dibayar"}
        />
        <MetaRow label="Tanggal" value={formatTanggal(data.printedAt)} />
        <MetaRow label="Jam" value={formatJam(data.printedAt)} />
        <MetaRow label="Tipe" value={`Antar${data.tableLabel ? ` - ${data.tableLabel}` : ""}`} />
      </div>

      <Rule />

      <div className="flex flex-col gap-2">
        {data.items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <span className="mt-0.5 shrink-0" aria-hidden>
              &#9633;
            </span>
            <div className="flex-1">
              <div className="flex justify-between gap-2">
                <span>{item.productName}</span>
                <span className="text-lg font-bold">x{item.qty}</span>
              </div>
              {item.addons.length > 0 && (
                <div className="text-[12px] text-neutral-700">{item.addons.join(", ")}</div>
              )}
              {item.notes && (
                <div className="text-[12px] italic text-neutral-700">&quot;{item.notes}&quot;</div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Rule />
      <div className="text-center text-[12px]">Bukan bukti bayar</div>
    </div>
  );
}
