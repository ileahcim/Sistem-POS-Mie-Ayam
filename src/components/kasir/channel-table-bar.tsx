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
export function ChannelTableBar({
  channel,
  tableLabel,
  onChannel,
  onTableLabel,
  className,
}: {
  className?: string;
  channel: ChannelType | null;
  tableLabel: TableLabel | null;
  onChannel: (c: ChannelType) => void;
  onTableLabel: (t: TableLabel) => void;
}) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 overflow-x-auto", className)}>
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
  );
}
