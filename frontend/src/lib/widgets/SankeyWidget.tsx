import { useCallback, useEffect, useMemo, useState } from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import { ControlsSection } from "@/components/widget-controls/ControlsSection";
import { ThresholdSlider } from "@/components/widget-controls/ThresholdSlider";
import { ZoomableChart } from "@/components/ZoomableChart";
import { api, type SankeyLink, type SankeyNode } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useTheme } from "@/lib/theme";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetControlState, WidgetProps } from "@/lib/widgets/types";

const SANKEY_USER_DEFAULTS_KEY = "sankey-widget-user-defaults";

const SANKEY_BUILTIN_DEFAULTS: WidgetControlState = {
  showControls: false,
  showAdvanced: false,
  detailZoom: 2,
  topNInMajor: 10,
  nodeThickness: 24,
  chartHeightRem: 20,
  maxNodes: 25,
  startDate: "",
  endDate: "",
  includeUncategorized: true,
  includeTransfers: false,
};

/** Round to integer for display (node/flow values in Sankey). */
function roundInt(value: number): number {
  return Math.round(value);
}

function SankeyChartInner({
  chartNodes,
  chartLinks,
  chartColors,
  nodeValueById,
  getNodeLabel,
  nodeThickness,
}: {
  chartNodes: Array<{ id: string; label: string }>;
  chartLinks: Array<{ source: string; target: string; value: number }>;
  chartColors: { palette: string[] };
  nodeValueById: Record<string, number>;
  getNodeLabel: (id: string) => string;
  nodeThickness: number;
}) {
  return (
    <ResponsiveSankey
      data={{ nodes: chartNodes, links: chartLinks }}
      margin={{ top: 24, right: 180, bottom: 24, left: 180 }}
      align="justify"
      colors={chartColors.palette}
      nodeOpacity={0.95}
      nodeThickness={nodeThickness}
      nodeSpacing={32}
      nodeBorderWidth={1}
      nodeBorderColor={{ from: "color", modifiers: [["darker", 0.5]] }}
      linkOpacity={0.35}
      linkHoverOpacity={0.65}
      linkContract={2}
      enableLinkGradient
      labelPosition="outside"
      labelOrientation="horizontal"
      labelPadding={28}
      labelTextColor={{ from: "color", modifiers: [["darker", 1]] }}
      label={(node) => String((node as { label?: string; id: string }).label ?? node.id)}
      valueFormat={(v) => String(roundInt(Number(v)))}
      nodeTooltip={({ node }) => {
        const id = String((node as { id: string }).id);
        const label = String((node as { label?: string; id: string }).label ?? id);
        const value = nodeValueById[id];
        return (
          <div className="rounded border border-border bg-card px-2 py-1 text-xs shadow">
            <div className="font-medium">{label}</div>
            {value != null && (
              <div className="text-muted-foreground">
                {formatCurrency(roundInt(value), "EUR", { maximumFractionDigits: 0 })}
              </div>
            )}
          </div>
        );
      }}
      linkTooltip={({ link }) => {
        const targetId = String(link.target.id);
        const sourceId = String(link.source.id);
        const categoryLabel =
          targetId === "total_income"
            ? getNodeLabel(sourceId)
            : getNodeLabel(targetId);
        const value = roundInt(Number(link.value));
        return (
          <div className="rounded border border-border bg-card px-2 py-1 text-xs shadow">
            <div className="font-medium">{categoryLabel}</div>
            <div className="text-muted-foreground">
              {formatCurrency(value, "EUR", { maximumFractionDigits: 0 })}
            </div>
          </div>
        );
      }}
    />
  );
}

function SankeyWidget({ filters, globalControls, widgetState, setWidgetState }: WidgetProps) {
  const { chartColors } = useTheme();
  const [nodes, setNodes] = useState<SankeyNode[]>([]);
  const [links, setLinks] = useState<SankeyLink[]>([]);
  const [showControls, setShowControls] = useState<boolean>(
    Boolean(widgetState?.showControls ?? false)
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    Boolean(widgetState?.showAdvanced ?? false)
  );
  const [maxNodes, setMaxNodes] = useState<number>(
    Number(widgetState?.maxNodes ?? 25)
  );
  const [includeUncategorized, setIncludeUncategorized] = useState<boolean>(
    Boolean(widgetState?.includeUncategorized ?? true)
  );
  const [includeTransfers, setIncludeTransfers] = useState<boolean>(
    Boolean(widgetState?.includeTransfers ?? false)
  );
  const [detailZoom, setDetailZoom] = useState<number>(
    Number(widgetState?.detailZoom ?? 2)
  );
  const [startDate, setStartDate] = useState<string>(
    (widgetState?.startDate as string) ?? filters.dateRange.start ?? ""
  );
  const [endDate, setEndDate] = useState<string>(
    (widgetState?.endDate as string) ?? filters.dateRange.end ?? ""
  );
  const [topNInMajor, setTopNInMajor] = useState<number>(
    Math.max(1, Math.min(25, Number(widgetState?.topNInMajor ?? 10)))
  );
  const [nodeThickness, setNodeThickness] = useState<number>(
    Math.max(12, Math.min(50, Number(widgetState?.nodeThickness ?? 24)))
  );
  const [chartHeightRem, setChartHeightRem] = useState<number>(
    Math.max(14, Math.min(48, Number(widgetState?.chartHeightRem ?? 20)))
  );

  useEffect(() => {
    setWidgetState?.({
      ...(widgetState ?? {}),
      showControls,
      showAdvanced,
      maxNodes,
      includeUncategorized,
      includeTransfers,
      detailZoom,
      startDate,
      endDate,
      topNInMajor,
      nodeThickness,
      chartHeightRem,
    });
    // Only sync when local control values change; omit widgetState/setWidgetState to avoid
    // infinite loop (setWidgetState updates parent state -> new widgetState -> effect re-runs).
  }, [
    includeTransfers,
    includeUncategorized,
    maxNodes,
    showAdvanced,
    showControls,
    detailZoom,
    startDate,
    endDate,
    topNInMajor,
    nodeThickness,
    chartHeightRem,
  ]);

  const sankeyParams = useMemo(() => {
    const base = toAnalyticsParams(filters, globalControls);
    return {
      ...base,
      startDate: startDate || base.startDate,
      endDate: endDate || base.endDate,
      includeTransfers,
    };
  }, [filters, globalControls, includeTransfers, startDate, endDate]);

  useEffect(() => {
    api
      .getSankey(sankeyParams)
      .then((res) => {
        setNodes(res.nodes);
        setLinks(res.links);
      })
      .catch(() => {
        setNodes([]);
        setLinks([]);
      });
  }, [sankeyParams]);

  const applyDefaults = useCallback(
    (defaults: WidgetControlState) => {
      setShowControls(Boolean(defaults.showControls ?? false));
      setShowAdvanced(Boolean(defaults.showAdvanced ?? false));
      setDetailZoom(Number(defaults.detailZoom ?? 2));
      setTopNInMajor(Math.max(1, Math.min(25, Number(defaults.topNInMajor ?? 10))));
      setNodeThickness(Math.max(12, Math.min(50, Number(defaults.nodeThickness ?? 24))));
      setChartHeightRem(Math.max(14, Math.min(48, Number(defaults.chartHeightRem ?? 20))));
      setMaxNodes(Math.max(10, Math.min(60, Number(defaults.maxNodes ?? 25))));
      setStartDate((defaults.startDate as string) ?? "");
      setEndDate((defaults.endDate as string) ?? "");
      setIncludeUncategorized(Boolean(defaults.includeUncategorized ?? true));
      setIncludeTransfers(Boolean(defaults.includeTransfers ?? false));
      setWidgetState?.({ ...(widgetState ?? {}), ...defaults });
    },
    [setWidgetState, widgetState]
  );

  const handleResetToDefault = useCallback(() => {
    try {
      const stored = typeof localStorage !== "undefined" ? localStorage.getItem(SANKEY_USER_DEFAULTS_KEY) : null;
      const defaults = stored ? (JSON.parse(stored) as WidgetControlState) : SANKEY_BUILTIN_DEFAULTS;
      applyDefaults(defaults);
    } catch {
      applyDefaults(SANKEY_BUILTIN_DEFAULTS);
    }
  }, [applyDefaults]);

  const handleSetAsDefault = useCallback(() => {
    const current: WidgetControlState = {
      showControls,
      showAdvanced,
      detailZoom,
      topNInMajor,
      nodeThickness,
      chartHeightRem,
      maxNodes,
      startDate,
      endDate,
      includeUncategorized,
      includeTransfers,
    };
    try {
      localStorage.setItem(SANKEY_USER_DEFAULTS_KEY, JSON.stringify(current));
    } catch {
      /* ignore */
    }
  }, [
    showControls,
    showAdvanced,
    detailZoom,
    topNInMajor,
    nodeThickness,
    chartHeightRem,
    maxNodes,
    startDate,
    endDate,
    includeUncategorized,
    includeTransfers,
  ]);

  if (!nodes.length || !links.length) {
    return <div className="text-sm text-muted-foreground">Not enough data for Sankey.</div>;
  }

  const effectiveMaxNodes = Math.min(120, maxNodes);

  const getNodeLabel = (id: string) => {
    if (id === "sankey_major") return "Major";
    if (id === "sankey_other") return "Other";
    return nodes.find((n) => n.id === id)?.label ?? id.replace(/^(in_|out_)/, "").replace("total_income", "Total income");
  };

  const filteredLinks = links.filter((link) => {
    if (link.value <= 0) return false;
    if (includeUncategorized) return true;
    const sourceLabel = nodes.find((n) => n.id === link.source)?.label.toLowerCase() ?? "";
    const targetLabel = nodes.find((n) => n.id === link.target)?.label.toLowerCase() ?? "";
    return !sourceLabel.includes("uncategor") && !targetLabel.includes("uncategor");
  });

  const incomeLinks = filteredLinks.filter((l) => l.target === "total_income");
  const expenseLinks = filteredLinks
    .filter((l) => l.source === "total_income")
    .slice(0, effectiveMaxNodes)
    .sort((a, b) => b.value - a.value);

  let chartNodes: Array<{ id: string; label: string }>;
  let chartLinks: Array<{ source: string; target: string; value: number }>;
  let splitPointValue: number | undefined;

  if (expenseLinks.length === 0) {
    const usedNodeIds = new Set<string>();
    for (const link of filteredLinks) {
      usedNodeIds.add(link.source);
      usedNodeIds.add(link.target);
    }
    chartNodes = nodes
      .filter((node) => usedNodeIds.has(node.id))
      .map((node) => ({ id: node.id, label: node.label }));
    const allowedNodeIds = new Set(chartNodes.map((n) => n.id));
    chartLinks = filteredLinks
      .filter((link) => allowedNodeIds.has(link.source) && allowedNodeIds.has(link.target))
      .map((link) => ({
        source: link.source,
        target: link.target,
        value: Number(link.value.toFixed(2)),
      }));
  } else {
    const N = Math.max(1, Math.min(25, topNInMajor));
    const majorLinks = expenseLinks.slice(0, N);
    const otherLinks = expenseLinks.slice(N);
    const incomeSourceIds = new Set(incomeLinks.map((l) => l.source));
    const totalIncomeNode = nodes.find((n) => n.id === "total_income") ?? { id: "total_income", label: "Total income" };
    const majorTargetNodes = nodes.filter((n) => majorLinks.some((l) => l.target === n.id));
    chartNodes = [
      totalIncomeNode,
      ...nodes.filter((n) => incomeSourceIds.has(n.id)),
      { id: "sankey_major", label: "Major" },
      ...(otherLinks.length > 0 ? [{ id: "sankey_other", label: "Other" }] : []),
      ...majorTargetNodes,
    ];
    const majorSum = majorLinks.reduce((s, l) => s + l.value, 0);
    const otherSum = otherLinks.reduce((s, l) => s + l.value, 0);
    chartLinks = [
      ...incomeLinks.map((l) => ({ source: l.source, target: l.target, value: Number(l.value.toFixed(2)) })),
      { source: "total_income", target: "sankey_major", value: Number(majorSum.toFixed(2)) },
      ...(otherLinks.length > 0
        ? [{ source: "total_income" as const, target: "sankey_other" as const, value: Number(otherSum.toFixed(2)) }]
        : []),
      ...majorLinks.map((l) => ({
        source: "sankey_major",
        target: l.target,
        value: Number(l.value.toFixed(2)),
      })),
    ];
    splitPointValue = majorLinks[Math.min(N, majorLinks.length) - 1]?.value;
  }

  const nodeValueById: Record<string, number> = {};
  for (const link of chartLinks) {
    nodeValueById[link.target] = (nodeValueById[link.target] ?? 0) + link.value;
  }

  if (!chartLinks.length) {
    return (
      <div className="text-sm text-muted-foreground">
        Not enough linked income/expense category data to render Sankey.
      </div>
    );
  }

  const detailZoomControls = (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Detail zoom</span>
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs"
        onClick={() => {
          setDetailZoom((prev) => Math.max(0, prev - 1));
          setMaxNodes((prev) => Math.max(10, prev - 6));
        }}
      >
        Less detail
      </button>
      <span className="text-xs tabular-nums text-muted-foreground">Level {detailZoom}</span>
      <button
        type="button"
        className="rounded-md border border-border px-2 py-1 text-xs"
        onClick={() => {
          setDetailZoom((prev) => Math.min(8, prev + 1));
          setMaxNodes((prev) => Math.min(120, prev + 6));
        }}
      >
        More detail
      </button>
    </div>
  );

  return (
    <div className="space-y-2">
      <ControlsSection
        showControls={showControls}
        onToggleControls={() => setShowControls((prev) => !prev)}
        extraTopRow={detailZoomControls}
      >
        <div className="space-y-2">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">N Categories for detailed display</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={1}
                max={25}
                step={1}
                value={topNInMajor}
                onChange={(e) => setTopNInMajor(Number(e.target.value))}
                className="h-2 w-24 flex-1 accent-primary"
              />
              <span className="text-xs tabular-nums">
                {topNInMajor}
                {splitPointValue != null && (
                  <span className="ml-1 text-muted-foreground">
                    ≈ {formatCurrency(roundInt(splitPointValue), "EUR", { maximumFractionDigits: 0 })}
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              onClick={handleResetToDefault}
            >
              Reset to default
            </button>
            <button
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs hover:bg-muted"
              onClick={handleSetAsDefault}
            >
              Set as default
            </button>
          </div>
          <div className="border-t border-border pt-2">
            <button
              type="button"
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowAdvanced((prev) => !prev)}
              aria-expanded={showAdvanced}
            >
              Advanced {showAdvanced ? "▲" : "▼"}
            </button>
            {showAdvanced && (
              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Time window</div>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      placeholder="Start"
                    />
                    <input
                      type="date"
                      className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-xs"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      placeholder="End"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeUncategorized}
                    onChange={(e) => setIncludeUncategorized(e.target.checked)}
                  />
                  Include uncategorized
                </label>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={includeTransfers}
                    onChange={(e) => setIncludeTransfers(e.target.checked)}
                  />
                  Include transfers
                </label>
                <ThresholdSlider
                  label="Node thickness"
                  min={12}
                  max={50}
                  step={1}
                  value={nodeThickness}
                  onChange={setNodeThickness}
                />
                <ThresholdSlider
                  label="Chart height (node height)"
                  min={14}
                  max={48}
                  step={2}
                  value={chartHeightRem}
                  onChange={setChartHeightRem}
                  suffix=" rem"
                />
                <ThresholdSlider
                  label="Max nodes"
                  min={10}
                  max={60}
                  step={1}
                  value={maxNodes}
                  onChange={setMaxNodes}
                />
              </div>
            )}
          </div>
        </div>
      </ControlsSection>
      <ZoomableChart
        zoomKey="chartZoom"
        widgetState={widgetState}
        setWidgetState={setWidgetState}
        showZoomControls
        enableWheelZoom
        minHeight={`${chartHeightRem}rem`}
      >
        <SankeyChartInner
          chartNodes={chartNodes}
          chartLinks={chartLinks}
          chartColors={chartColors}
          nodeValueById={nodeValueById}
          getNodeLabel={getNodeLabel}
          nodeThickness={nodeThickness}
        />
      </ZoomableChart>
    </div>
  );
}

registerWidget({
  id: "sankey",
  name: "Sankey Flow",
  description: "Money flow from income sources to expense buckets.",
  category: "advanced",
  defaultSize: "full",
  component: SankeyWidget,
});
