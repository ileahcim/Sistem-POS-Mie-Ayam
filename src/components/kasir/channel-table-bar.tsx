import type { ChannelType, TableLabel } from "@/lib/cart/types";
import { TABLE_LABELS } from "@/lib/cart/types";
import { cn } from "@/components/ui/cn";

const CHANNELS: { value: ChannelType; label: string }[] = [
  { value: "DINE_IN", label: "Dine In" },
  { value: "BUNGKUS", label: "Bungkus" },
  { value: "ANTAR", label: "Antar" },
];

// No transitions here on purpose — channel/table pick must feel instant.
export function ChannelTableBar({
  channel,
  tableLabel,
  onChannel,
  onTableLabel,
}: {
  channel: ChannelType | null;
  tableLabel: TableLabel | null;
  onChannel: (c: ChannelType) => void;
  onTableLabel: (t: TableLabel) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-surface px-3 py-1.5">
      {CHANNELS.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onChannel(c.value)}
          className={cn(
            "rounded-pill h-12 min-w-24 px-4 text-base font-semibold",
            channel === c.value ? "bg-primary text-white" : "bg-muted text-ink",
          )}
        >
          {c.label}
        </button>
      ))}

      {channel === "DINE_IN" && (
        <>
          <div className="mx-1 h-8 w-px bg-border" aria-hidden />
          {TABLE_LABELS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTableLabel(t)}
              className={cn(
                "rounded-pill h-12 w-16 text-base font-semibold",
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
