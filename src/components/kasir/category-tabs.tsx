import { cn } from "@/components/ui/cn";

export function CategoryTabs({
  categories,
  activeId,
  onSelect,
}: {
  categories: { id: string; name: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto border-b border-border bg-surface px-3 py-1.5">
      {categories.map((cat) => (
        <button
          key={cat.id}
          type="button"
          onClick={() => onSelect(cat.id)}
          className={cn(
            "rounded-pill h-12 shrink-0 whitespace-nowrap px-5 text-base font-semibold",
            activeId === cat.id ? "bg-ink text-white" : "bg-muted text-ink",
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
