import type { ReactNode } from "react";

export function ControlsSection({
  showControls,
  onToggleControls,
  showAdvanced,
  onToggleAdvanced,
  children,
  advanced,
}: {
  showControls: boolean;
  onToggleControls: () => void;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
  children: ReactNode;
  advanced?: ReactNode;
}) {
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
        <button
          className="rounded-md border border-border px-2 py-1 text-xs"
          onClick={onToggleAdvanced}
          aria-label={showAdvanced ? "Hide advanced controls" : "Show advanced controls"}
        >
          {showAdvanced ? "Hide advanced" : "Advanced"}
        </button>
      </div>
      {showControls ? <div className="space-y-2">{children}</div> : null}
      {showControls && showAdvanced && advanced ? (
        <div className="space-y-2 border-t border-border pt-2">{advanced}</div>
      ) : null}
    </div>
  );
}
