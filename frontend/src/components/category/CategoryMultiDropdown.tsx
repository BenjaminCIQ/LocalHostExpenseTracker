import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/api";
import CategoryTreePicker from "@/components/category/CategoryTreePicker";

export default function CategoryMultiDropdown({
  categories,
  selectedIds,
  onChange,
  search,
  onSearchChange,
  placeholder = "All categories",
}: {
  categories: Category[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const selectedNames = useMemo(
    () =>
      categories
        .filter((cat) => selectedIds.includes(cat.id))
        .map((cat) => cat.name),
    [categories, selectedIds]
  );

  return (
    <div ref={rootRef} className="relative mt-1">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="truncate">
          {selectedIds.length === 0 ? placeholder : `${selectedIds.length} selected`}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute z-20 mt-1 w-[max(100%,22rem)] max-w-[32rem] rounded-md border border-border bg-background p-3 shadow-lg">
          <CategoryTreePicker
            categories={categories}
            selectedIds={selectedIds}
            search={search}
            onSearchChange={onSearchChange}
            onChange={onChange}
          />
          {selectedNames.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedNames.slice(0, 8).map((name) => (
                <span
                  key={name}
                  className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground"
                  title={name}
                >
                  {name}
                </span>
              ))}
              {selectedNames.length > 8 && (
                <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                  +{selectedNames.length - 8}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

