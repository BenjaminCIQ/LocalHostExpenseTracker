import { Button } from "@/components/ui/button";
import { getAllWidgets } from "@/lib/widgets/registry";
import type { LayoutEntry } from "@/lib/widgets/types";

export function WidgetCatalog({
  open,
  layout,
  onClose,
  onAdd,
  onRemove,
}: {
  open: boolean;
  layout: LayoutEntry[];
  onClose: () => void;
  onAdd: (widgetId: string) => void;
  onRemove: (widgetId: string) => void;
}) {
  if (!open) return null;
  const enabled = new Set(layout.map((entry) => entry.widgetId));
  const widgets = getAllWidgets();

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-card p-4 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Widget catalog</h3>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="max-h-[60vh] space-y-3 overflow-auto">
          {widgets.map((widget) => {
            const isEnabled = enabled.has(widget.id);
            return (
              <div
                key={widget.id}
                className="flex items-center justify-between rounded-md border border-border p-3"
              >
                <div>
                  <div className="font-medium">{widget.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {widget.description}
                  </div>
                </div>
                {isEnabled ? (
                  <Button variant="destructive" onClick={() => onRemove(widget.id)}>
                    Remove
                  </Button>
                ) : (
                  <Button onClick={() => onAdd(widget.id)}>Add</Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
