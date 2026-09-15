import type { ReceiptData } from "@/lib/printing/types";
import { formatRupiah, mergeReceiptItems } from "@/lib/printing/format";

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
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

// Simulates an 80mm thermal receipt on screen: narrow fixed width, monospace,
// dashed rules instead of printer perforation lines.
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
        <div>Antrian #{data.queueNumber}</div>
        <div>{formatDateTime(data.printedAt)}</div>
        <div>{channelLine}</div>
      </div>

      <div className="my-2 border-t border-dashed border-black" />

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
                {item.addons.map((a) => a.name).join(", ")}
              </div>
            )}
            {item.notes && (
              <div className="pl-3 text-[12px] italic text-neutral-700">&quot;{item.notes}&quot;</div>
            )}
          </div>
        ))}
      </div>

      <div className="my-2 border-t border-dashed border-black" />

      <div className="flex justify-between">
        <span>Subtotal</span>
        <span>{formatRupiah(data.subtotal)}</span>
      </div>
      {data.deliveryFee > 0 && (
        <div className="flex justify-between">
          <span>Ongkir</span>
          <span>{formatRupiah(data.deliveryFee)}</span>
        </div>
      )}
      <div className="mt-1 flex justify-between text-base font-bold">
        <span>Total</span>
        <span>{formatRupiah(data.total)}</span>
      </div>

      <div className="my-2 border-t border-dashed border-black" />

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

      <div className="mt-3 text-center text-[12px]">
        {data.footerNote ?? "Terima kasih!"}
      </div>
    </div>
  );
}
