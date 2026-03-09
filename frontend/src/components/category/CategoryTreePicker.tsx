import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Category } from "@/lib/api";
import {
  buildCategoryTree,
  filterCategoryTree,
  flattenCategoryTree,
  type CategoryTreeNode,
} from "@/lib/categoryHierarchy";
import { cn } from "@/lib/utils";

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

export default function CategoryTreePicker({
  categories,
  selectedIds,
  onChange,
  search,
  onSearchChange,
  className,
}: {
  categories: Category[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  search: string;
  onSearchChange: (value: string) => void;
  className?: string;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const tree = useMemo(() => buildCategoryTree(categories), [categories]);
  const filteredTree = useMemo(
    () => filterCategoryTree(tree, search),
    [tree, search]
  );
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
  const allVisibleIds = useMemo(
    () => visibleRows.map((row) => row.id),
    [visibleRows]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-border px-2.5 py-1.5 text-xs"
          onClick={() => onChange(Array.from(new Set([...selectedIds, ...allVisibleIds])))}
        >
          Select visible
        </button>
        <button
          type="button"
          className="rounded-md border border-border px-2.5 py-1.5 text-xs"
          onClick={() => onChange([])}
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
        onChange={(e) => onSearchChange(e.target.value)}
      />
      <div className="max-h-72 overflow-auto rounded-md border border-border p-1">
        <div className="space-y-0.5">
          {visibleRows.map((row) => {
            const active = selectedIds.includes(row.id);
            return (
              <label
                key={row.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm",
                  active ? "bg-primary/10" : "hover:bg-muted/40"
                )}
                title={row.name}
              >
                <span
                  className="inline-flex items-center"
                  style={{ marginLeft: `${row.depth * 14}px` }}
                >
                  {row.hasChildren ? (
                    <button
                      type="button"
                      className="mr-1 rounded p-0.5 hover:bg-muted"
                      onClick={(e) => {
                        e.preventDefault();
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
                        <ChevronDown className="h-3 w-3" />
                      ) : (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                  ) : (
                    <span className="mr-1 inline-block w-4" />
                  )}
                </span>
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => {
                    onChange(
                      active
                        ? selectedIds.filter((id) => id !== row.id)
                        : [...selectedIds, row.id]
                    );
                  }}
                />
                <span className="min-w-0 flex-1 break-words leading-tight">{row.name}</span>
                <span className="ml-2 rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {row.is_income ? "income" : "expense"}
                </span>
              </label>
            );
          })}
          {visibleRows.length === 0 && (
            <div className="px-2 py-4 text-center text-xs text-muted-foreground">
              No matching categories.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

