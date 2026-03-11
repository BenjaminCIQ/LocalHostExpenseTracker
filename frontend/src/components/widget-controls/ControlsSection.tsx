import type { ReactNode } from "react";

export function ControlsSection({
  showControls,
  onToggleControls,
  showAdvanced,
  onToggleAdvanced,
  children,
  advanced,
  extraTopRow,
}: {
  showControls: boolean;
  onToggleControls: () => void;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
  children: ReactNode;
  advanced?: ReactNode;
  /** Rendered in the top row next to the Show controls button (e.g. Detail zoom). */
  extraTopRow?: ReactNode;
}) {
  const hasAdvanced = showAdvanced !== undefined && onToggleAdvanced !== undefined && advanced !== undefined;
  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={onToggleControls}
          aria-label={showControls ? "Hide widget controls" : "Show widget controls"}
        >
          {showControls ? "Hide controls" : "Show controls"}
        </button>
        {hasAdvanced && (
          <button
            className="rounded-md border border-border px-2 py-1 text-xs"
            onClick={onToggleAdvanced}
            aria-label={showAdvanced ? "Hide advanced controls" : "Show advanced controls"}
          >
            {showAdvanced ? "Hide advanced" : "Advanced"}
          </button>
        )}
        {extraTopRow}
      </div>
      {showControls ? <div className="space-y-2">{children}</div> : null}
      {showControls && hasAdvanced && showAdvanced && advanced ? (
        <div className="space-y-2 border-t border-border pt-2">{advanced}</div>
      ) : null}
    </div>
  );
}
