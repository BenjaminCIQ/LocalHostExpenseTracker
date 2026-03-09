import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GlobalControlsBar } from "@/components/GlobalControlsBar";
import { WidgetCatalog } from "@/components/WidgetCatalog";
import { WidgetShell } from "@/components/WidgetShell";
import { useDashboardFilters } from "@/lib/widgets/DashboardFiltersContext";
import { loadWidgetControls, saveWidgetControls } from "@/lib/widgets/controlsStore";
import { getWidget } from "@/lib/widgets/registry";
import { getDefaultLayout, loadLayout, resetLayout, saveLayout } from "@/lib/widgets/layoutStore";
import type {
  LayoutEntry,
  PageId,
  WidgetControlState,
  WidgetSize,
} from "@/lib/widgets/types";

function sizeClass(size: WidgetSize) {
  if (size === "sm" || size === "md") return "xl:col-span-1";
  if (size === "lg") return "xl:col-span-2";
  if (size === "xl") return "xl:col-span-3";
  return "xl:col-span-4";
}

export default function DashboardComposer({ page }: { page: PageId }) {
  const { filters, globalControls } = useDashboardFilters();
  const [layout, setLayout] = useState<LayoutEntry[]>(() => loadLayout(page));
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [widgetStates, setWidgetStates] = useState<Record<string, WidgetControlState>>(
    {}
  );
  const persistTimers = useRef<Record<string, number>>({});
  const widgetSetterRefs = useRef<
    Record<string, (next: WidgetControlState) => void>
  >({});
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedFilters(filters), 250);
    return () => window.clearTimeout(id);
  }, [filters]);

  useEffect(() => {
    return () => {
      Object.values(persistTimers.current).forEach((timer) =>
        window.clearTimeout(timer)
      );
    };
  }, []);

  const sortedLayout = useMemo(
    () => [...layout].sort((a, b) => a.order - b.order),
    [layout]
  );

  useEffect(() => {
    setWidgetStates((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const entry of sortedLayout) {
        if (!(entry.widgetId in next)) {
          next[entry.widgetId] = loadWidgetControls(page, entry.widgetId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [page, sortedLayout]);

  function updateLayout(entries: LayoutEntry[]) {
    setLayout(entries);
    saveLayout(page, entries);
  }

  function move(widgetId: string, direction: -1 | 1) {
    const current = [...sortedLayout];
    const idx = current.findIndex((entry) => entry.widgetId === widgetId);
    const nextIdx = idx + direction;
    if (idx < 0 || nextIdx < 0 || nextIdx >= current.length) return;
    const temp = current[idx];
    current[idx] = current[nextIdx];
    current[nextIdx] = temp;
    updateLayout(current.map((entry, index) => ({ ...entry, order: index + 1 })));
  }

  function removeWidget(widgetId: string) {
    updateLayout(
      sortedLayout
        .filter((entry) => entry.widgetId !== widgetId)
        .map((entry, index) => ({ ...entry, order: index + 1 }))
    );
  }

  function addWidget(widgetId: string) {
    if (sortedLayout.some((entry) => entry.widgetId === widgetId)) return;
    const widget = getWidget(widgetId);
    if (!widget) return;
    updateLayout([
      ...sortedLayout,
      {
        widgetId,
        size: widget.defaultSize,
        order: sortedLayout.length + 1,
      },
    ]);
  }

  function getWidgetState(widgetId: string): WidgetControlState {
    return widgetStates[widgetId] ?? {};
  }

  function setWidgetState(widgetId: string, next: WidgetControlState) {
    setWidgetStates((prev) => ({ ...prev, [widgetId]: next }));
    const key = `${page}:${widgetId}`;
    if (persistTimers.current[key]) {
      window.clearTimeout(persistTimers.current[key]);
    }
    persistTimers.current[key] = window.setTimeout(() => {
      saveWidgetControls(page, widgetId, next);
    }, 200);
  }

  function getWidgetSetter(widgetId: string) {
    if (!widgetSetterRefs.current[widgetId]) {
      widgetSetterRefs.current[widgetId] = (next: WidgetControlState) =>
        setWidgetState(widgetId, next);
    }
    return widgetSetterRefs.current[widgetId];
  }

  function resetPageLayout() {
    resetLayout(page);
    const defaults = getDefaultLayout(page);
    setLayout(defaults);
  }

  return (
    <div className="space-y-4">
      <GlobalControlsBar />
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={() => setCatalogOpen(true)}>Add widget</Button>
        <Button variant="outline" onClick={resetPageLayout}>
          Reset layout
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-4">
        {sortedLayout.map((entry, index) => {
          const widget = getWidget(entry.widgetId);
          if (!widget) return null;
          const WidgetComponent = widget.component;
          return (
            <div key={entry.widgetId} className={sizeClass(entry.size)}>
              <WidgetShell
                title={widget.name}
                onMoveUp={index > 0 ? () => move(entry.widgetId, -1) : undefined}
                onMoveDown={
                  index < sortedLayout.length - 1
                    ? () => move(entry.widgetId, 1)
                    : undefined
                }
                onRemove={() => removeWidget(entry.widgetId)}
              >
                <WidgetComponent
                  filters={debouncedFilters}
                  size={entry.size}
                  globalControls={globalControls}
                  widgetState={getWidgetState(entry.widgetId)}
                  setWidgetState={getWidgetSetter(entry.widgetId)}
                />
              </WidgetShell>
            </div>
          );
        })}
      </div>

      <WidgetCatalog
        open={catalogOpen}
        layout={layout}
        onClose={() => setCatalogOpen(false)}
        onAdd={addWidget}
        onRemove={removeWidget}
      />
    </div>
  );
}
