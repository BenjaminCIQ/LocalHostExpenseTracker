import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function WidgetShell({
  title,
  children,
  isEditMode = false,
  onRemove,
}: {
  title: string;
  children: ReactNode;
  isEditMode?: boolean;
  onRemove?: () => void;
}) {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (!isMaximized) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMaximized(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isMaximized]);

  return (
    <>
      <Card className="flex h-full flex-col overflow-hidden">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="widget-drag-handle cursor-grab active:cursor-grabbing text-base">
              {title}
            </CardTitle>
            <div className="widget-action flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsMaximized((prev) => !prev)}
                title={isMaximized ? "Restore widget" : "Maximize widget"}
              >
                {isMaximized ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5" />
                    Restore
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5" />
                    Maximize
                  </>
                )}
              </Button>
              {isEditMode && onRemove ? (
                <Button size="sm" variant="destructive" onClick={onRemove}>
                  Remove
                </Button>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-auto">
          {isMaximized ? (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Widget is maximized.
            </div>
          ) : (
            children
          )}
        </CardContent>
      </Card>
      {isMaximized
        ? createPortal(
            <div className="fixed inset-0 z-[200] bg-black/50 p-4">
              <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col rounded-lg border border-border bg-card shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-lg font-semibold">{title}</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="widget-action"
                    onClick={() => setIsMaximized(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                    Close
                  </Button>
                </div>
                <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
