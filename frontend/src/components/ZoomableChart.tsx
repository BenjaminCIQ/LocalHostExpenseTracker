import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { WidgetControlState } from "@/lib/widgets/types";

/**
 * Reusable zoomable chart wrapper for widgets. Provides visual zoom (scale + scroll),
 * optional persistence in widgetState, optional +/- controls and Ctrl+wheel zoom,
 * and an optional tooltip dock so tooltips stay in view when zoomed. Any widget can
 * use this for consistent zoom and dock behavior.
 */

/** Context for rendering chart tooltips into a fixed dock so they stay in view when zoomed. */
export const TooltipDockContext = createContext<{
  setTooltipContent: (content: ReactNode) => void;
} | null>(null);

export function useTooltipDock() {
  return useContext(TooltipDockContext);
}

export interface ZoomableChartProps {
  children: ReactNode;
  /** Minimum height of the viewport (e.g. "20rem" or 320). */
  minHeight?: string | number;
  className?: string;
  /** Key in widgetState for persisting zoom (e.g. "chartZoom"). */
  zoomKey?: string;
  widgetState?: WidgetControlState;
  setWidgetState?: (next: WidgetControlState) => void;
  /** Show zoom minus/plus and percentage. */
  showZoomControls?: boolean;
  /** Ctrl+wheel (or Cmd+wheel) to zoom. Default true. */
  enableWheelZoom?: boolean;
  /** Show a fixed strip where tooltip content is rendered (use with useTooltipDock). */
  tooltipDock?: boolean;
}

const DEFAULT_MIN_HEIGHT = "20rem";
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;
const WHEEL_ZOOM_STEP = 0.1;

export function ZoomableChart({
  children,
  minHeight = DEFAULT_MIN_HEIGHT,
  className = "",
  zoomKey,
  widgetState,
  setWidgetState,
  showZoomControls = false,
  enableWheelZoom = true,
  tooltipDock = true,
}: ZoomableChartProps) {
  const isPersistenceEnabled =
    zoomKey != null && widgetState != null && setWidgetState != null;

  const [zoom, setZoomState] = useState(() => {
    if (zoomKey != null && widgetState != null && typeof widgetState[zoomKey] === "number") {
      return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(widgetState[zoomKey])));
    }
    return 1;
  });
  const widgetStateRef = useRef(widgetState);
  widgetStateRef.current = widgetState;

  const setZoom = useCallback(
    (delta: number) => {
      setZoomState((prev) => {
        const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta));
        if (isPersistenceEnabled && zoomKey && setWidgetState) {
          setWidgetState({ ...(widgetStateRef.current ?? {}), [zoomKey]: next });
        }
        return next;
      });
    },
    [isPersistenceEnabled, zoomKey, setWidgetState]
  );

  const [tooltipContent, setTooltipContentState] = useState<ReactNode>(null);
  const setTooltipContent = useCallback((content: ReactNode) => {
    setTooltipContentState(content);
  }, []);

  const contextValue = useMemo(
    () => (tooltipDock ? { setTooltipContent } : null),
    [tooltipDock, setTooltipContent]
  );

  const heightStyle =
    typeof minHeight === "number" ? `${minHeight}px` : minHeight;

  return (
    <TooltipDockContext.Provider value={contextValue}>
      <div className={`flex flex-col gap-2 ${className}`.trim()}>
        {showZoomControls && (
          <div className="relative z-10 flex shrink-0 items-center gap-2">
            <span className="text-xs text-muted-foreground">Chart zoom</span>
            <button
              type="button"
              className="min-h-[2.25rem] min-w-[2.25rem] cursor-pointer select-none rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50 touch-manipulation"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setZoom(-ZOOM_STEP);
              }}
              aria-label="Zoom out"
            >
              −
            </button>
            <span className="min-w-[3ch] text-xs tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              className="min-h-[2.25rem] min-w-[2.25rem] cursor-pointer select-none rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted focus:outline-none focus:ring-2 focus:ring-primary/50 touch-manipulation"
              onPointerDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setZoom(ZOOM_STEP);
              }}
              aria-label="Zoom in"
            >
              +
            </button>
          </div>
        )}
        <div className="relative z-0 flex min-h-0 flex-1 flex-col">
          <div
            className="overflow-auto rounded-md border border-border shrink-0"
            style={{ minHeight: heightStyle }}
            onWheel={(e) => {
              if (!enableWheelZoom || (!e.ctrlKey && !e.metaKey)) return;
              e.preventDefault();
              setZoom(e.deltaY > 0 ? -WHEEL_ZOOM_STEP : WHEEL_ZOOM_STEP);
            }}
          >
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: "0 0",
                width: "100%",
                minHeight: heightStyle,
              }}
            >
              {children}
            </div>
          </div>
          {tooltipDock && (
            <div
              className="pointer-events-none mt-1 min-h-[2rem] shrink-0 text-xs text-muted-foreground"
              aria-live="polite"
            >
              {tooltipContent}
            </div>
          )}
        </div>
      </div>
    </TooltipDockContext.Provider>
  );
}
