import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactGridLayout from "react-grid-layout";
import { Lock, LockOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalControlsBar } from "@/components/GlobalControlsBar";
import { WidgetCatalog } from "@/components/WidgetCatalog";
import { WidgetShell } from "@/components/WidgetShell";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useDashboardFilters } from "@/lib/widgets/DashboardFiltersContext";
import { loadWidgetControls, saveWidgetControls } from "@/lib/widgets/controlsStore";
import { getWidget } from "@/lib/widgets/registry";
import {
  getDefaultLayout,
  hasGridFields,
  LAYOUT_VERSION,
  loadLayout,
  resetLayout,
  saveLayout,
} from "@/lib/widgets/layoutStore";
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

function defaultHeight(size: WidgetSize, widgetId?: string) {
  if (widgetId === "kpi-cards") return 4;
  if (size === "md" || size === "sm") return 6;
  return 8;
}

export default function DashboardComposer({ page }: { page: PageId }) {
  const { person } = useAuth();
  const { filters, globalControls } = useDashboardFilters();
  const [layout, setLayout] = useState<LayoutEntry[]>(() => loadLayout(page, null));
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
    if (!person) return;
    const personId = person.id;
    setLayout(loadLayout(page, personId));
    let cancelled = false;
    api
      .getWidgetLayout(page)
      .then((res) => {
        if (cancelled) return;
        if (res && Array.isArray(res.entries) && res.entries.length > 0 && res.entries.every(hasGridFields)) {
          setLayout(res.entries as LayoutEntry[]);
          saveLayout(page, res.entries as LayoutEntry[], personId);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [page, person?.id]);

  useEffect(() => {
    localStorage.setItem(`${EDIT_MODE_KEY}-${page}`, isEditMode ? "1" : "0");
  }, [isEditMode, page]);

  const rglLayout = useMemo(
    () =>
      layout.map((entry) => {
        const isKpi = entry.widgetId === "kpi-cards";
        return {
          i: entry.widgetId,
          x: entry.x,
          y: entry.y,
          w: entry.w,
          h: entry.h,
          static: !isEditMode,
          isDraggable: isEditMode,
          isResizable: isEditMode,
          minW: isKpi ? 4 : 3,
          maxW: 12,
          minH: 1,
          maxH: 20,
          resizeHandles: ["w", "e", "s", "sw", "se"],
        };
      }),
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
      const personId = person?.id ?? null;
      saveLayout(page, entries, personId);
      api
        .saveWidgetLayout(page, { v: LAYOUT_VERSION, entries })
        .catch(() => {});
    },
    [page, person?.id]
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
        h: defaultHeight(widget.defaultSize, widgetId),
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
    const defaultEntries = getDefaultLayout(page);
    resetLayout(page, person?.id ?? null);
    setLayout(defaultEntries);
    api.saveWidgetLayout(page, { v: LAYOUT_VERSION, entries: defaultEntries }).catch(() => {});
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
          {isEditMode ? (
            <>
              <LockOpen className="mr-1.5 h-4 w-4" />
              Lock layout
            </>
          ) : (
            <>
              <Lock className="mr-1.5 h-4 w-4" />
              Unlock layout
            </>
          )}
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
          rowHeight={20}
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
                  <ErrorBoundary>
                    <WidgetComponent
                      filters={debouncedFilters}
                      size={entry.size}
                      globalControls={globalControls}
                      widgetState={getWidgetState(entry.widgetId)}
                      setWidgetState={getWidgetSetter(entry.widgetId)}
                    />
                  </ErrorBoundary>
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
