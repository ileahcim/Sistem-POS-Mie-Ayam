import type { ChannelType, TableLabel } from "@/lib/cart/types";
import { TABLE_LABELS } from "@/lib/cart/types";
import { cn } from "@/components/ui/cn";

const CHANNELS: { value: ChannelType; label: string }[] = [
  { value: "DINE_IN", label: "Dine In" },
  { value: "BUNGKUS", label: "Bungkus" },
  { value: "ANTAR", label: "Antar" },
];

// No transitions here on purpose — channel/table pick must feel instant.
// No background/border of its own: it sits inside a header surface (Kasir)
// or gets one from the caller via className (Pre-order).
//
// The customer name lives on this row too (it used to sit inside the cart):
// channel, table and name are all "about the order", and the cart gets the
// room back. Tablet and short landscape windows: one line, name field at the
// end. Narrower: the name drops to its own full-width line under the
// buttons, because the button strip already scrolls sideways there and a
// field hidden off-screen would never be found.
export function ChannelTableBar({
  channel,
  tableLabel,
  onChannel,
  onTableLabel,
  customerName,
  onCustomerNameChange,
  namePlaceholder = "Nama (opsional)",
  className,
}: {
  className?: string;
  channel: ChannelType | null;
  tableLabel: TableLabel | null;
  onChannel: (c: ChannelType) => void;
  onTableLabel: (t: TableLabel) => void;
  customerName: string;
  onCustomerNameChange: (name: string) => void;
  namePlaceholder?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2 lg:flex-nowrap [@media(max-height:500px)]:flex-nowrap",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
        {CHANNELS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChannel(c.value)}
            className={cn(
              "rounded-pill h-12 min-w-24 shrink-0 px-4 text-base font-semibold",
              channel === c.value ? "bg-primary text-white" : "bg-muted text-ink",
            )}
          >
            {c.label}
          </button>
        ))}

        {channel === "DINE_IN" && (
          <>
            <div className="mx-1 h-8 w-px shrink-0 bg-border" aria-hidden />
            {TABLE_LABELS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTableLabel(t)}
                className={cn(
                  "rounded-pill h-12 w-16 shrink-0 text-base font-semibold",
                  tableLabel === t ? "bg-primary text-white" : "bg-muted text-ink",
                )}
              >
                {t}
              </button>
            ))}
          </>
        )}
      </div>
      <input
        type="text"
        value={customerName}
        onChange={(e) => onCustomerNameChange(e.target.value)}
        placeholder={namePlaceholder}
        aria-label={namePlaceholder}
        className="rounded-input border-border bg-surface text-ink h-12 w-full shrink-0 border px-3 text-base lg:w-52 [@media(max-height:500px)]:h-10 [@media(max-height:500px)]:w-36"
      />
    </div>
  );
}
