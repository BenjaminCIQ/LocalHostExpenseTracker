import { useMemo, useState } from "react";

export interface CategoryOption {
  id: number;
  name: string;
}

export function CategoryMultiSelect({
  options,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  search,
  onSearchChange,
}: {
  options: CategoryOption[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClear: () => void;
  search: string;
  onSearchChange: (value: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const q = search.trim().toLowerCase();
  const visible = q
    ? options.filter((opt) => opt.name.toLowerCase().includes(q))
    : options;
  const maxVisible = 12;
  const displayed = showAll || q ? visible : visible.slice(0, maxVisible);
  const hiddenCount = Math.max(visible.length - displayed.length, 0);
  const selectedCount = useMemo(
    () => selectedIds.filter((id) => options.some((opt) => opt.id === id)).length,
    [options, selectedIds]
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={onSelectAll}
        >
          Select all
        </button>
        <button
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={onClear}
        >
          Clear
        </button>
        <input
          className="h-7 rounded-md border border-border bg-background px-2 text-xs"
          placeholder="Search categories..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        <span className="text-xs text-muted-foreground">
          {selectedCount} selected
        </span>
      </div>
      <div className="max-h-24 overflow-auto">
        <div className="flex flex-wrap gap-2">
          {displayed.map((opt) => {
            const active = selectedIds.includes(opt.id);
            return (
              <label
                key={opt.id}
                className={`cursor-pointer rounded-md border px-2 py-1 text-xs ${
                  active ? "border-primary bg-primary/10" : "border-border"
                }`}
              >
                <input
                  type="checkbox"
                  className="mr-1"
                  checked={active}
                  onChange={() => onToggle(opt.id)}
                />
                {opt.name}
              </label>
            );
          })}
          {!q && hiddenCount > 0 && (
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              onClick={() => setShowAll(true)}
            >
              +{hiddenCount} more
            </button>
          )}
          {!q && showAll && visible.length > maxVisible && (
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              onClick={() => setShowAll(false)}
            >
              Show fewer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
