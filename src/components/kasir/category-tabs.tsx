import { cn } from "@/components/ui/cn";
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
            className={cn(
              "rounded-pill flex h-12 shrink-0 items-center gap-1.5 whitespace-nowrap px-5 text-base font-semibold",
              meta ? (isActive ? meta.active : meta.inactive) : isActive ? "bg-ink text-white" : "bg-muted text-ink",
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
