import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export function MerchantMultiSelect({
  options,
  selected,
  onChange,
  search,
  onSearchChange,
  placeholder = "All merchants",
  label = "Merchants",
}: {
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  search: string;
  onSearchChange: (next: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const q = search.trim().toLowerCase();
  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })),
    [options]
  );
  const visible = useMemo(
    () => (q ? sortedOptions.filter((opt) => opt.toLowerCase().includes(q)) : sortedOptions),
    [sortedOptions, q]
  );
  const allImplicitlySelected = selected.length === 0;

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

  function isChecked(name: string) {
    return allImplicitlySelected || selectedSet.has(name);
  }

  function toggleMerchant(name: string) {
    if (allImplicitlySelected) {
      // Default state means all are selected. Unchecking one creates an explicit subset.
      onChange(sortedOptions.filter((merchant) => merchant !== name));
      return;
    }
    const next = new Set(selectedSet);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    onChange(Array.from(next).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })));
  }

  return (
    <div ref={rootRef} className="relative space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpen((v) => !v)}>
        <span className="truncate">
          {allImplicitlySelected
            ? placeholder
            : selected.length > 0
              ? `${selected.length} selected`
              : placeholder}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      {open ? (
        <div className="absolute z-20 mt-1 w-[max(100%,22rem)] max-w-[32rem] rounded-md border border-border bg-background p-3 shadow-lg">
          <div className="mb-2 flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs"
              placeholder="Search merchants..."
            />
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              onClick={() => onChange(visible)}
            >
              Select visible
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs"
              onClick={() => onChange([])}
            >
              Select all
            </button>
          </div>
          <div className="max-h-56 overflow-auto rounded border border-border p-1">
            <div className="space-y-1">
              {visible.map((name) => (
                <label
                  key={name}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted/60"
                >
                  <input type="checkbox" checked={isChecked(name)} onChange={() => toggleMerchant(name)} />
                  <span className="truncate">{name}</span>
                </label>
              ))}
              {visible.length === 0 ? (
                <span className="px-2 py-1 text-xs text-muted-foreground">No merchants found.</span>
              ) : null}
            </div>
          </div>
          {allImplicitlySelected ? (
            <div className="mt-2 text-[11px] text-muted-foreground">
              All merchants selected.
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
