import { cn } from "@/components/ui/cn";

// Neutral tabs: every category is the same light grey with dark text, and
// only the selected one is brand green — icons follow the text color.
import { CATEGORY_META } from "./category-icons";

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
      {categories.map((cat) => {
        const meta = CATEGORY_META[cat.name];
        const isActive = activeId === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            aria-pressed={isActive}
            className={cn(
              "rounded-pill flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap px-5 text-base font-semibold",
              isActive ? "bg-primary text-white" : "bg-muted text-ink",
            )}
          >
            {meta && <meta.Icon />}
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
