import type { ReceiptData } from "@/lib/printing/types";
import { formatRupiah, mergeReceiptItems, groupAddonsForPrint, formatAddonWithQty } from "@/lib/printing/format";
import { paperRule, centeredRule } from "@/lib/printing/paper";
import { formatId } from "@/lib/timezone";
import { formatQueueLabel } from "@/lib/orders/queue-label";

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

function formatDateTime(date: Date): string {
  return formatId(date, { dateStyle: "medium", timeStyle: "short" });
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
  const channelLine =
    data.channel === "DINE_IN" && data.tableLabel
      ? `${CHANNEL_LABEL[data.channel]} · ${data.tableLabel}`
      : CHANNEL_LABEL[data.channel];

  return (
    <div className="mx-auto w-[320px] bg-white p-4 font-mono text-[13px] leading-relaxed text-black">
      <div className="text-center">
        <div className="text-base font-bold">{data.storeName}</div>
        <div>No. Order {data.orderNumber}</div>
        <div>Antrian {formatQueueLabel(data.queueNumber, data.queueSuffix)}</div>
        <div>{formatDateTime(data.printedAt)}</div>
        <div>{channelLine}</div>
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
