import type { WidgetCategory, WidgetDefinition } from "@/lib/widgets/types";

const WIDGET_REGISTRY = new Map<string, WidgetDefinition>();

export function registerWidget(def: WidgetDefinition) {
  WIDGET_REGISTRY.set(def.id, def);
}

export function getWidget(id: string) {
  return WIDGET_REGISTRY.get(id) ?? null;
}

export function getAllWidgets() {
  return Array.from(WIDGET_REGISTRY.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function getWidgetsByCategory(category: WidgetCategory) {
  return getAllWidgets().filter((w) => w.category === category);
}
