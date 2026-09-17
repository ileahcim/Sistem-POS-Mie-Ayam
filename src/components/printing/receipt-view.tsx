import type { ReceiptData } from "@/lib/printing/types";
import { formatRupiah, mergeReceiptItems, groupAddonsForPrint, formatAddonWithQty, totalItemCount } from "@/lib/printing/format";
import { paperRule, centeredRule } from "@/lib/printing/paper";
import { formatId } from "@/lib/timezone";
import { ReceiptHeader, MetaRow } from "./receipt-meta";

const CHANNEL_LABEL: Record<ReceiptData["channel"], string> = {
  DINE_IN: "Dine In",
  BUNGKUS: "Bungkus",
  ANTAR: "Antar",
};

const PAYMENT_LABEL: Record<ReceiptData["paymentMethod"], string> = {
  CASH: "Cash",
  QRIS: "QRIS",
  TRANSFER: "Transfer",
};

function formatTanggal(date: Date): string {
  return formatId(date, { day: "numeric", month: "short", year: "numeric" });
}

function formatJam(date: Date): string {
  return formatId(date, { hour: "2-digit", minute: "2-digit", hour12: false });
}

// A literal repeated-character rule ("====" / "----"), the same string an
// actual ESC/POS printer would receive (see src/lib/printing/paper.ts) —
// not a CSS border. Rendered small enough that RECEIPT_CHARS_PER_LINE
// characters span exactly the printable width, same as it would on paper.
function Rule({ char }: { char: "=" | "-" }) {
  return <div className="my-1.5 overflow-hidden text-[9px] leading-none whitespace-pre">{paperRule(char)}</div>;
}

// Simulates an 80mm thermal receipt on screen: narrow fixed width,
// monospace, with the same "=" / "-" rule characters the real printer will
// eventually receive — thick "=" between major sections, thin "-" between
// lines within one section (see CLAUDE.md "Struk & printer").
export function ReceiptView({ data }: { data: ReceiptData }) {
  const items = mergeReceiptItems(data.items);
  const tipeLine =
    data.channel === "DINE_IN" && data.tableLabel
      ? `${CHANNEL_LABEL[data.channel]} - ${data.tableLabel}`
      : CHANNEL_LABEL[data.channel];

  return (
    <div className="mx-auto w-[320px] bg-white p-4 font-mono text-[13px] leading-relaxed text-black">
      <ReceiptHeader storeName={data.storeName} address={data.address} phone={data.phone} />

      <Rule char="=" />

      {/* Nomor antrian sengaja tidak dicetak di struk — order sudah lunas,
          antrian cuma relevan sebelum dibayar (lihat daftar packing). */}
      <div className="flex flex-col">
        <MetaRow label="No. Order" value={String(data.orderNumber)} />
        <MetaRow label="Tanggal" value={formatTanggal(data.printedAt)} />
        <MetaRow label="Jam" value={formatJam(data.printedAt)} />
        <MetaRow label="Kasir" value={data.kasirName} />
        <MetaRow label="Tipe" value={tipeLine} />
      </div>

      <Rule char="=" />

      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={i}>
            <div className="flex justify-between gap-2">
              <span>
                {item.qty}x {item.productName}
              </span>
              <span>{formatRupiah(item.lineTotal)}</span>
            </div>
            {item.addons.length > 0 && (
              <div className="pl-3 text-[12px] text-neutral-700">
                {groupAddonsForPrint(item.addons).map(formatAddonWithQty).join(", ")}
              </div>
            )}
            {item.notes && (
              <div className="pl-3 text-[12px] italic text-neutral-700">&quot;{item.notes}&quot;</div>
            )}
          </div>
        ))}
      </div>

      <Rule char="=" />

      <div className="flex justify-between text-[12px] text-neutral-700">
        <span>{totalItemCount(items)} item</span>
      </div>
      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatRupiah(data.subtotal)}</span>
      </div>
      {data.deliveryFee > 0 && (
        <>
          <Rule char="-" />
          <div className="flex justify-between">
            <span>Ongkir</span>
            <span>{formatRupiah(data.deliveryFee)}</span>
          </div>
        </>
      )}
      <Rule char="-" />
      <div className="flex justify-between text-base font-bold">
        <span>Total</span>
        <span>{formatRupiah(data.total)}</span>
      </div>

      <Rule char="-" />

      <div className="flex justify-between">
        <span>Bayar ({PAYMENT_LABEL[data.paymentMethod]})</span>
        <span>{formatRupiah(data.cashTendered ?? data.total)}</span>
      </div>
      {data.changeGiven != null && data.changeGiven > 0 && (
        <div className="flex justify-between">
          <span>Kembali</span>
          <span>{formatRupiah(data.changeGiven)}</span>
        </div>
      )}

      <Rule char="=" />

      <div className="overflow-hidden text-center text-[9px] leading-none whitespace-pre">
        {centeredRule(data.footerNote ?? "Terima kasih!")}
      </div>
    </div>
  );
}
