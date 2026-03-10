import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Account } from "@/lib/api";

export default function AccountMultiDropdown({
  accounts,
  selectedIds,
  onChange,
  search,
  onSearchChange,
  placeholder = "All accounts",
}: {
  accounts: Account[];
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter((a) => `${a.name} ${a.bank_name} ${a.account_type}`.toLowerCase().includes(q));
  }, [accounts, search]);

  const selectedNames = useMemo(
    () => accounts.filter((a) => selectedIds.includes(a.id)).map((a) => a.name),
    [accounts, selectedIds]
  );

  const toggleId = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <div ref={rootRef} className="relative mt-1">
      <Button type="button" variant="outline" className="w-full justify-between" onClick={() => setOpen((v) => !v)}>
        <span className="truncate">
          {selectedIds.length === 0 ? placeholder : `${selectedIds.length} selected`}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute z-20 mt-1 w-[max(100%,20rem)] max-w-[28rem] rounded-md border border-border bg-background p-3 shadow-lg">
          <input
            className="mb-2 h-8 w-full rounded-md border border-border bg-background px-2 text-sm"
            placeholder="Search accounts..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <div className="max-h-56 overflow-auto space-y-1">
            {filtered.map((acc) => (
              <label key={acc.id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted/50">
                <input type="checkbox" checked={selectedIds.includes(acc.id)} onChange={() => toggleId(acc.id)} />
                <span className="truncate">{acc.name}</span>
                <span className="text-xs text-muted-foreground truncate">{acc.bank_name}</span>
              </label>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground px-2 py-1">No accounts match.</p>
            )}
          </div>
          {selectedNames.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedNames.slice(0, 8).map((name) => (
                <span key={name} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
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
