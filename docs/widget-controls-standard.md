# Widget Controls Standard

This document defines the control conventions used by dashboard widgets.

## Control Hierarchy

1. **Global controls** (page level): time window, granularity, scope, value mode.
2. **Widget controls** (local): widget-specific filters and display switches.
3. **Advanced controls** (local, hidden): expert options like thresholds/methods.

## Ordering Rule

Control groups should be presented in this order:
1. Time
2. Scope
3. Grouping
4. Thresholds
5. Display mode

## Global Controls

Defined by `GlobalControlState`:

- `dateWindow`: `7D | 30D | 90D | YTD | 1Y | ALL`
- `granularity`: `auto | daily | weekly | monthly | quarterly | yearly`
- `scope`: `household | person | account`
- `valueMode`: `absolute | percent_share | normalized_per_day`

Global controls are shown once via `GlobalControlsBar`.

## Widget-Local Controls Pattern

Widgets should use `ControlsSection`:

- `Show controls` / `Hide controls`
- `Advanced` toggle
- body for standard controls
- optional advanced area

This keeps controls visually consistent and avoids bespoke UI layouts.

## Widget Matrix (Required Controls)

### Time-series widgets
Examples: Interactive category bar, category trend, running balance.

- Time brush or range control
- Granularity override
- Top-N and/or contribution threshold
- Stacked/grouped/combined display switch where relevant

### Category composition widgets
Examples: category pie, enhanced pie.

- Grouping mode
- Minimum slice size
- Label toggle
- Sort mode

### Sankey widget

- Minimum link threshold
- Include uncategorized toggle
- Max nodes cap

### Outlier widget

- Sensitivity
- Minimum amount
- Advanced method selector

### Budget widgets

- Horizon
- Alert threshold
- Optional forecast indicator toggle

## Persistence

Storage keys:

- Layout: `widget-layout-{pageId}`
- Global controls: `widget-global-controls-{pageId}`
- Widget controls: `widget-controls-{pageId}-{widgetId}`

Persisted payload format:

```json
{
  "schemaVersion": 1,
  "savedAt": "2026-03-09T00:00:00.000Z",
  "data": {}
}
```

Rules:

- Save on change
- Restore on load
- Validate shape
- Unknown/invalid values fallback to defaults
- Version mismatch resets only affected control set

## Performance and Accessibility

- Debounce global filter propagation by 250ms.
- Keep transformed chart data memoized.
- Keep controls keyboard reachable.
- Provide visible focus states.
- Add labels for icon-only controls.

## Rollout Phases

1. Core framework and persistence
2. Priority widgets: InteractiveCategoryBar, Sankey, Outlier, BudgetStatus, CategoryTrend
3. Remaining widgets and consistency pass

## Acceptance Criteria

- Global + local + advanced hierarchy is used consistently.
- Control state persists by page and widget.
- Global reset and per-widget reset are supported by data model.
- Threshold controls exist for Sankey, category bar, outlier.
