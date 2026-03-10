import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout from "react-grid-layout";
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
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const GridLayout = ReactGridLayout as any;
const EDIT_MODE_KEY = "widget-edit-mode";

function widthFromSize(size: WidgetSize) {
  if (size === "full") return 12;
  if (size === "xl") return 8;
  if (size === "lg") return 6;
  if (size === "md") return 4;
  return 3;
}

function defaultHeight(size: WidgetSize) {
  if (size === "md" || size === "sm") return 6;
  return 8;
}

export default function DashboardComposer({ page }: { page: PageId }) {
  const { filters, globalControls } = useDashboardFilters();
  const [layout, setLayout] = useState<LayoutEntry[]>(() => loadLayout(page));
  const [isEditMode, setIsEditMode] = useState<boolean>(
    () => localStorage.getItem(`${EDIT_MODE_KEY}-${page}`) === "1"
  );
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [widgetStates, setWidgetStates] = useState<Record<string, WidgetControlState>>({});
  const persistTimers = useRef<Record<string, number>>({});
  const widgetSetterRefs = useRef<Record<string, (next: WidgetControlState) => void>>({});
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const [gridWidth, setGridWidth] = useState(1200);

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedFilters(filters), 250);
    return () => window.clearTimeout(id);
  }, [filters]);

  useEffect(() => {
    return () => {
      Object.values(persistTimers.current).forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const measure = () => setGridWidth(Math.max(320, Math.floor(node.clientWidth)));
    measure();
    const obs = new ResizeObserver(measure);
    obs.observe(node);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    localStorage.setItem(`${EDIT_MODE_KEY}-${page}`, isEditMode ? "1" : "0");
  }, [isEditMode, page]);

  const rglLayout = useMemo(
    () =>
      layout.map((entry) => ({
        i: entry.widgetId,
        x: entry.x,
        y: entry.y,
        w: entry.w,
        h: entry.h,
        static: !isEditMode,
        isDraggable: isEditMode,
        isResizable: isEditMode,
        minW: 3,
        maxW: 12,
        minH: 3,
        maxH: 20,
        resizeHandles: ["w", "e", "s", "sw", "se"],
      })),
    [isEditMode, layout]
  );

  useEffect(() => {
    setWidgetStates((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const entry of layout) {
        if (!(entry.widgetId in next)) {
          next[entry.widgetId] = loadWidgetControls(page, entry.widgetId);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [page, layout]);

  const persistLayout = useCallback(
    (entries: LayoutEntry[]) => {
      setLayout(entries);
      saveLayout(page, entries);
    },
    [page]
  );

  const handleStop = useCallback(
    (rgl: any[]) => {
      const byId = new Map(layout.map((e) => [e.widgetId, e]));
      const next: LayoutEntry[] = rgl
        .map((item: any) => {
          const existing = byId.get(item.i);
          if (!existing) return null;
          return {
            ...existing,
            x: item.x,
            y: item.y,
            w: item.w,
            h: item.h,
          } satisfies LayoutEntry;
        })
        .filter((e): e is LayoutEntry => e !== null);

      if (next.length === layout.length) {
        persistLayout(next);
      }
    },
    [layout, persistLayout]
  );

  function removeWidget(widgetId: string) {
    persistLayout(
      layout
        .filter((e) => e.widgetId !== widgetId)
        .map((e, i) => ({ ...e, order: i + 1 }))
    );
  }

  function addWidget(widgetId: string) {
    if (layout.some((e) => e.widgetId === widgetId)) return;
    const widget = getWidget(widgetId);
    if (!widget) return;
    persistLayout([
      ...layout,
      {
        widgetId,
        size: widget.defaultSize,
        order: layout.length + 1,
        x: 0,
        y: Infinity,
        w: widthFromSize(widget.defaultSize),
        h: defaultHeight(widget.defaultSize),
      },
    ]);
  }

  function getWidgetState(widgetId: string): WidgetControlState {
    return widgetStates[widgetId] ?? {};
  }

  function setWidgetState(widgetId: string, next: WidgetControlState) {
    setWidgetStates((prev) => ({ ...prev, [widgetId]: next }));
    const key = `${page}:${widgetId}`;
    if (persistTimers.current[key]) window.clearTimeout(persistTimers.current[key]);
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
    setLayout(getDefaultLayout(page));
  }

  return (
    <div className="space-y-4">
      <GlobalControlsBar />
      <div className="flex flex-wrap items-center gap-2">
        <Button className="w-full sm:w-auto" onClick={() => setCatalogOpen(true)}>
          Add widget
        </Button>
        <Button className="w-full sm:w-auto" variant="outline" onClick={resetPageLayout}>
          Reset layout
        </Button>
        <Button
          className="w-full sm:w-auto"
          variant={isEditMode ? "default" : "outline"}
          onClick={() => setIsEditMode((prev) => !prev)}
        >
          {isEditMode ? "Editing layout" : "Edit layout"}
        </Button>
        {isEditMode && (
          <span className="text-xs text-muted-foreground">
            Drag titles to move · resize from edges / corners
          </span>
        )}
      </div>

      <div ref={containerRef}>
        <GridLayout
          className={isEditMode ? "layout layout-editing" : "layout"}
          cols={12}
          width={gridWidth}
          rowHeight={28}
          margin={[10, 10]}
          containerPadding={[0, 0]}
          compactType="vertical"
          isDraggable={isEditMode}
          isResizable={isEditMode}
          draggableHandle=".widget-drag-handle"
          draggableCancel=".widget-action"
          layout={rglLayout}
          onDragStop={(next: any) => handleStop(next)}
          onResizeStop={(next: any) => handleStop(next)}
        >
          {layout.map((entry) => {
            const widget = getWidget(entry.widgetId);
            if (!widget) return null;
            const WidgetComponent = widget.component;
            return (
              <div key={entry.widgetId}>
                <WidgetShell
                  title={widget.name}
                  isEditMode={isEditMode}
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
        </GridLayout>
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
