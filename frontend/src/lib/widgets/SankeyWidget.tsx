import { useEffect, useState } from "react";
import { ResponsiveSankey } from "@nivo/sankey";
import { ControlsSection } from "@/components/widget-controls/ControlsSection";
import { ThresholdSlider } from "@/components/widget-controls/ThresholdSlider";
import { api, type SankeyLink, type SankeyNode } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { registerWidget } from "@/lib/widgets/registry";
import { toAnalyticsParams } from "@/lib/widgets/helpers";
import type { WidgetProps } from "@/lib/widgets/types";

function SankeyWidget({ filters, widgetState, setWidgetState }: WidgetProps) {
  const { chartColors } = useTheme();
  const [nodes, setNodes] = useState<SankeyNode[]>([]);
  const [links, setLinks] = useState<SankeyLink[]>([]);
  const [showControls, setShowControls] = useState<boolean>(
    Boolean(widgetState?.showControls ?? false)
  );
  const [showAdvanced, setShowAdvanced] = useState<boolean>(
    Boolean(widgetState?.showAdvanced ?? false)
  );
  const [minLinkValue, setMinLinkValue] = useState<number>(
    Number(widgetState?.minLinkValue ?? 0)
  );
  const [maxNodes, setMaxNodes] = useState<number>(
    Number(widgetState?.maxNodes ?? 40)
  );
  const [includeUncategorized, setIncludeUncategorized] = useState<boolean>(
    Boolean(widgetState?.includeUncategorized ?? true)
  );
  const [includeTransfers, setIncludeTransfers] = useState<boolean>(
    Boolean(widgetState?.includeTransfers ?? false)
  );

  useEffect(() => {
    setWidgetState?.({
      showControls,
      showAdvanced,
      minLinkValue,
      maxNodes,
      includeUncategorized,
      includeTransfers,
    });
  }, [
    includeTransfers,
    includeUncategorized,
    maxNodes,
    minLinkValue,
    setWidgetState,
    showAdvanced,
    showControls,
  ]);

  useEffect(() => {
    api
      .getSankey({ ...toAnalyticsParams(filters), includeTransfers })
      .then((res) => {
        setNodes(res.nodes);
        setLinks(res.links);
      })
      .catch(() => {
        setNodes([]);
        setLinks([]);
      });
  }, [filters, includeTransfers]);

  if (!nodes.length || !links.length) {
    return <div className="text-sm text-muted-foreground">Not enough data for Sankey.</div>;
  }

  const filteredLinks = links.filter((link) => {
    if (link.value <= 0) return false;
    if (link.value < minLinkValue) return false;
    if (includeUncategorized) return true;
    const sourceLabel = nodes.find((n) => n.id === link.source)?.label.toLowerCase() ?? "";
    const targetLabel = nodes.find((n) => n.id === link.target)?.label.toLowerCase() ?? "";
    return !sourceLabel.includes("uncategor") && !targetLabel.includes("uncategor");
  });
  const usedNodeIds = new Set<string>();
  for (const link of filteredLinks) {
    usedNodeIds.add(link.source);
    usedNodeIds.add(link.target);
  }
  const chartNodes = nodes
    .filter((node) => usedNodeIds.has(node.id))
    .slice(0, maxNodes)
    .map((node) => ({ id: node.id, label: node.label }));
  const allowedNodeIds = new Set(chartNodes.map((n) => n.id));
  const chartLinks = filteredLinks
    .filter((link) => allowedNodeIds.has(link.source) && allowedNodeIds.has(link.target))
    .map((link) => ({
      source: link.source,
      target: link.target,
      value: Number(link.value.toFixed(2)),
    }));

  if (!chartLinks.length) {
    return (
      <div className="text-sm text-muted-foreground">
        Not enough linked income/expense category data to render Sankey.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <ControlsSection
        showControls={showControls}
        onToggleControls={() => setShowControls((prev) => !prev)}
        showAdvanced={showAdvanced}
        onToggleAdvanced={() => setShowAdvanced((prev) => !prev)}
        advanced={
          <ThresholdSlider
            label="Max nodes"
            min={10}
            max={60}
            step={1}
            value={maxNodes}
            onChange={setMaxNodes}
          />
        }
      >
        <div className="grid gap-2 md:grid-cols-2">
          <ThresholdSlider
            label="Minimum link value"
            min={0}
            max={500}
            step={10}
            value={minLinkValue}
            onChange={setMinLinkValue}
          />
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
        </div>
      </ControlsSection>
      <div className="h-80">
      <ResponsiveSankey
        data={{ nodes: chartNodes, links: chartLinks }}
        margin={{ top: 20, right: 140, bottom: 20, left: 140 }}
        align="justify"
        colors={chartColors.palette}
        nodeOpacity={0.95}
        nodeThickness={18}
        nodeSpacing={12}
        nodeBorderWidth={1}
        nodeBorderColor={{ from: "color", modifiers: [["darker", 0.5]] }}
        linkOpacity={0.35}
        linkHoverOpacity={0.65}
        linkContract={2}
        enableLinkGradient
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={14}
        labelTextColor={{ from: "color", modifiers: [["darker", 1]] }}
        label={(node) => String((node as { label?: string; id: string }).label ?? node.id)}
        valueFormat=">-.2f"
        nodeTooltip={({ node }) => (
          <div className="rounded border border-border bg-card px-2 py-1 text-xs shadow">
            <div className="font-medium">
              {String((node as { label?: string; id: string }).label ?? node.id)}
            </div>
          </div>
        )}
        linkTooltip={({ link }) => (
          <div className="rounded border border-border bg-card px-2 py-1 text-xs shadow">
            <div>
              {String(link.source.id)}
              {" -> "}
              {String(link.target.id)}
            </div>
            <div className="font-medium">{Number(link.value).toFixed(2)}</div>
          </div>
        )}
      />
      </div>
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
