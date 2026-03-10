import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Category } from "@/lib/api";
import {
  buildCategoryTree,
  filterCategoryTree,
  flattenCategoryTree,
  type CategoryTreeNode,
} from "@/lib/categoryHierarchy";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CategoryValue = number | "" | null;

function collectIds(nodes: CategoryTreeNode[]): number[] {
  const ids: number[] = [];
  const walk = (items: CategoryTreeNode[]) => {
    for (const node of items) {
      ids.push(node.id);
      walk(node.children);
    }
  };
  walk(nodes);
  return ids;
}

export default function CategorySelect({
  categories,
  value,
  onChange,
  className,
  placeholder = "Select...",
  noneValue = "",
  mode = "path",
  excludeIds = [],
  disabled = false,
}: {
  categories: Category[];
  value: CategoryValue;
  onChange: (value: CategoryValue) => void;
  className?: string;
  placeholder?: string;
  noneValue?: "" | null;
  mode?: "path" | "indented";
  excludeIds?: number[];
  disabled?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const visibleCategories = useMemo(() => {
    const blocked = new Set(excludeIds);
    return categories.filter((cat) => !blocked.has(cat.id));
  }, [categories, excludeIds]);

  const selected = useMemo(
    () => visibleCategories.find((cat) => cat.id === value) ?? null,
    [value, visibleCategories]
  );

  const tree = useMemo(() => buildCategoryTree(visibleCategories), [visibleCategories]);
  const allExpandedIds = useMemo(
    () => new Set(visibleCategories.map((cat) => cat.id)),
    [visibleCategories]
  );
  const pathLabelById = useMemo(() => {
    const fullRows = flattenCategoryTree(tree, {
      includePath: true,
      expandedIds: allExpandedIds,
    });
    return new Map(fullRows.map((row) => [row.id, row.path.join(" / ")]));
  }, [allExpandedIds, tree]);
  const filteredTree = useMemo(() => filterCategoryTree(tree, search), [tree, search]);
  const visibleRows = useMemo(() => {
    const useExpanded =
      search.trim().length > 0
        ? new Set(collectIds(filteredTree))
        : expandedIds;
    return flattenCategoryTree(filteredTree, {
      includePath: false,
      expandedIds: useExpanded,
    });
  }, [expandedIds, filteredTree, search]);
  const allVisibleIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);

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

  const selectedLabel =
    selected === null
      ? placeholder
      : mode === "path"
        ? pathLabelById.get(selected.id) ?? selected.name
        : selected.name;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn("truncate", selected ? "text-foreground" : "text-muted-foreground")}>
          {selectedLabel}
        </span>
        <ChevronDown className="h-4 w-4" />
      </Button>
      {open && (
        <div className="absolute z-20 mt-1 w-[max(100%,22rem)] max-w-[32rem] rounded-md border border-border bg-background p-3 shadow-lg">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-2.5 py-1.5 text-xs"
              onClick={() => onChange(noneValue)}
            >
              Clear
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2.5 py-1.5 text-xs"
              onClick={() => setExpandedIds(new Set(allVisibleIds))}
            >
              Expand all
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2.5 py-1.5 text-xs"
              onClick={() => setExpandedIds(new Set())}
            >
              Collapse all
            </button>
          </div>
          <input
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            placeholder="Search categories..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-2 max-h-72 overflow-auto rounded-md border border-border p-1">
            <div className="space-y-0.5">
              {visibleRows.map((row) => (
                <div
                  key={row.id}
                  role="button"
                  tabIndex={0}
                  className={cn(
                    "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm",
                    value === row.id ? "bg-primary/10" : "hover:bg-muted/40"
                  )}
                  title={row.name}
                  onClick={() => {
                    // For parent categories, first tap expands to reduce accidental parent selection.
                    if (row.hasChildren && !search.trim() && !expandedIds.has(row.id)) {
                      setExpandedIds((prev) => {
                        const next = new Set(prev);
                        next.add(row.id);
                        return next;
                      });
                      return;
                    }
                    onChange(row.id);
                    setOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (row.hasChildren && !search.trim() && !expandedIds.has(row.id)) {
                        setExpandedIds((prev) => {
                          const next = new Set(prev);
                          next.add(row.id);
                          return next;
                        });
                        return;
                      }
                      onChange(row.id);
                      setOpen(false);
                    }
                  }}
                >
                  <span
                    className="inline-flex items-center"
                    style={{ marginLeft: `${row.depth * 14}px` }}
                  >
                    {row.hasChildren ? (
                      <button
                        type="button"
                        className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/70 bg-background hover:bg-muted"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setExpandedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.id)) next.delete(row.id);
                            else next.add(row.id);
                            return next;
                          });
                        }}
                        aria-label={`Toggle ${row.name}`}
                      >
                        {expandedIds.has(row.id) || search.trim() ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    ) : (
                      <span className="mr-1 inline-block w-6" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 break-words leading-tight">{row.name}</span>
                  <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {row.is_income ? "income" : "expense"}
                  </span>
                </div>
              ))}
              {visibleRows.length === 0 && (
                <div className="px-2 py-4 text-center text-xs text-muted-foreground">
                  No matching categories.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

