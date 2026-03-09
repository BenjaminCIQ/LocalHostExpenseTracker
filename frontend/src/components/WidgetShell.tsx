import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ReactNode } from "react";

export function WidgetShell({
  title,
  children,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  title: string;
  children: ReactNode;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onRemove?: () => void;
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2">
            {onMoveUp ? (
              <Button size="sm" variant="outline" onClick={onMoveUp}>
                Up
              </Button>
            ) : null}
            {onMoveDown ? (
              <Button size="sm" variant="outline" onClick={onMoveDown}>
                Down
              </Button>
            ) : null}
            {onRemove ? (
              <Button size="sm" variant="destructive" onClick={onRemove}>
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
