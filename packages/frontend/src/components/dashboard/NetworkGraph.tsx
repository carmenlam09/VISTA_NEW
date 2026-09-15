import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Maximize2, Minus, Plus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { useNetworkGraph } from "@/hooks/useNetworkGraph";
import { RISK_TIERS, RISK_TIER_ORDER } from "@/lib/risk";
import type { NetworkGraphData, NetworkNode, PersonNode } from "@/types/network";
import type { VendorRisk } from "@/types/overview";

type SimNode = NetworkNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode>;

// Fixed hexes rather than theme tokens: these encode what a node *is*, so
// they must stay stable across themes. Company is OCBC red.
const BRAND_RED = "#ED1A2D";
const NODE_COLOR: Record<NetworkNode["kind"], string> = {
  company: BRAND_RED,
  director: "#F59E0B",
  shareholder: "#10B981",
};

const NODE_RADIUS: Record<NetworkNode["kind"], number> = {
  company: 15,
  director: 9,
  shareholder: 9,
};

const LEGEND: { kind: NetworkNode["kind"]; label: string }[] = [
  { kind: "company", label: "Company" },
  { kind: "shareholder", label: "Shareholder" },
  { kind: "director", label: "Director" },
];

type RelationshipFilter = "all" | "directors" | "shareholders";
const FILTER_LABELS: Record<RelationshipFilter, string> = {
  all: "All relationships",
  directors: "Directors only",
  shareholders: "Shareholders only",
};

const STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  in_review: { variant: "warning", label: "In Review" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

/** The canvas grows to fill its card; this is only the floor. */
const MIN_HEIGHT = 440;
/** Space kept clear at the bottom for the risk legend and zoom pill. */
const BOTTOM_CHROME = 44;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

/**
 * Rough advance width of the 11px label font. Erring slightly wide is the
 * safe direction: over-estimating flips a label that just fits (harmless),
 * under-estimating lets it clip against the canvas edge.
 */
const LABEL_CHAR_WIDTH = 6.8;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function isSimNode(value: string | number | SimNode): value is SimNode {
  return typeof value === "object";
}

interface Transform {
  k: number;
  x: number;
  y: number;
}

/** Vertical space one label occupies, including a little breathing room. */
const LABEL_HEIGHT = 15;

/** Horizontal span a node's circle plus its text label covers. */
function labelExtent(node: SimNode, width: number) {
  const x = node.x ?? 0;
  const r = NODE_RADIUS[node.kind];
  const labelWidth = node.label.length * LABEL_CHAR_WIDTH;
  const flipped = x + r + 7 + labelWidth > width;
  return flipped
    ? { left: x - r - 7 - labelWidth, right: x + r }
    : { left: x - r, right: x + r + 7 + labelWidth };
}

/**
 * Nudges nodes apart vertically when their *labels* would overlap.
 *
 * forceCollide only knows about the circles, but a label runs ~200px to one
 * side, so two nodes far enough apart to satisfy collision can still have
 * their text printed on top of each other. This runs after the forces each
 * tick and pushes overlapping pairs apart on the y axis only, which resolves
 * the text without fighting the layout's horizontal structure.
 */
function separateLabels(nodes: SimNode[], width: number) {
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      const ay = a.y ?? 0;
      const by = b.y ?? 0;
      const dy = by - ay;
      if (Math.abs(dy) >= LABEL_HEIGHT) continue;

      const ea = labelExtent(a, width);
      const eb = labelExtent(b, width);
      if (ea.right < eb.left || eb.right < ea.left) continue;

      // Split the shortfall between them, unless one is being dragged - a
      // pinned node keeps its position and the other moves the full amount.
      const shortfall = (LABEL_HEIGHT - Math.abs(dy)) / 2 + 0.5;
      const dir = dy === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dy);
      const aPinned = a.fy != null;
      const bPinned = b.fy != null;
      if (!aPinned) a.y = ay - dir * shortfall * (bPinned ? 2 : 1);
      if (!bPinned) b.y = by + dir * shortfall * (aPinned ? 2 : 1);
    }
  }
}

/** Drops people of the excluded role, plus any edge that loses an endpoint. */
function applyFilter(data: NetworkGraphData, filter: RelationshipFilter): NetworkGraphData {
  if (filter === "all") return data;
  const keepKind = filter === "directors" ? "director" : "shareholder";
  const nodes = data.nodes.filter((n) => n.kind === "company" || n.kind === keepKind);
  const ids = new Set(nodes.map((n) => n.id));
  return { nodes, edges: data.edges.filter((e) => ids.has(e.source) && ids.has(e.target)) };
}

export function NetworkGraph() {
  const { data: rawData, isLoading, isError } = useNetworkGraph();
  const { data: overview } = useDashboardOverview();
  const [filter, setFilter] = useState<RelationshipFilter>("all");
  const data = useMemo(() => (rawData ? applyFilter(rawData, filter) : undefined), [rawData, filter]);

  const riskByVendorId = useMemo(
    () => new Map<string, VendorRisk>((overview?.risk.byVendor ?? []).map((v) => [v.vendorId, v])),
    [overview]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(640);
  const widthRef = useRef(width);
  widthRef.current = width;
  const [height, setHeight] = useState(MIN_HEIGHT);
  const heightRef = useRef(height);
  heightRef.current = height;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, forceRerender] = useState(0);

  const [transform, setTransform] = useState<Transform>({ k: 1, x: 0, y: 0 });
  // Pointer handlers read the live transform without being re-created on
  // every zoom, so dragging stays correct mid-gesture.
  const transformRef = useRef(transform);
  transformRef.current = transform;

  const simNodesRef = useRef<SimNode[]>([]);
  const simLinksRef = useRef<SimLink[]>([]);
  const simulationRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const draggingRef = useRef<SimNode | null>(null);

  const hasCanvas = Boolean(data && data.nodes.length > 0);

  // Attach once the canvas actually exists - it's behind the loading and
  // empty states, so observing on first mount would observe nothing and
  // leave the SVG stuck at its default width.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(Math.max(320, el.clientWidth));
    setHeight(Math.max(MIN_HEIGHT, el.clientHeight));
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setWidth(Math.max(320, entry.contentRect.width));
      setHeight(Math.max(MIN_HEIGHT, entry.contentRect.height));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasCanvas]);

  useEffect(() => {
    if (!data) return;

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = data.edges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    simNodesRef.current = nodes;
    simLinksRef.current = links;
    setTransform({ k: 1, x: 0, y: 0 });
    if (selectedId && !nodeById.has(selectedId)) setSelectedId(null);

    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(105)
          .strength(0.5)
      )
      .force("charge", forceManyBody().strength(-320))
      .force("center", forceCenter(widthRef.current / 2, (heightRef.current - BOTTOM_CHROME) / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => NODE_RADIUS[d.kind] + 34)
      )
      .on("tick", () => {
        // Isolated nodes have nothing pulling them toward center, so
        // unbounded repulsion can push them off-canvas - clamp each tick.
        const w = widthRef.current;
        const h = heightRef.current - BOTTOM_CHROME;
        const clampAll = () => {
          for (const n of nodes) {
            const r = NODE_RADIUS[n.kind];
            n.x = Math.max(r, Math.min(w - r, n.x ?? w / 2));
            n.y = Math.max(r, Math.min(h - r, n.y ?? h / 2));
          }
        };
        clampAll();
        separateLabels(nodes, w);
        // Separation can push a node back out of bounds, so clamp again.
        clampAll();
        forceRerender((t) => t + 1);
      });

    simulationRef.current = simulation;
    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
    // Re-run only when the (filtered) data changes - width is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    sim.force("center", forceCenter(width / 2, (height - BOTTOM_CHROME) / 2));
    sim.alpha(0.3).restart();
  }, [width, height]);

  /** Screen coords -> graph coords, undoing the current pan/zoom. */
  function toGraphPoint(clientX: number, clientY: number) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const t = transformRef.current;
    return { x: (clientX - rect.left - t.x) / t.k, y: (clientY - rect.top - t.y) / t.k };
  }

  const zoomBy = useCallback((factor: number) => {
    setTransform((t) => {
      const k = clamp(t.k * factor, MIN_ZOOM, MAX_ZOOM);
      // Anchor the zoom on the canvas centre so the view doesn't drift.
      const cx = widthRef.current / 2;
      const cy = heightRef.current / 2;
      const gx = (cx - t.x) / t.k;
      const gy = (cy - t.y) / t.k;
      return { k, x: cx - gx * k, y: cy - gy * k };
    });
  }, []);

  const fitView = useCallback(() => {
    const nodes = simNodesRef.current;
    if (nodes.length === 0) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const r = NODE_RADIUS[n.kind];
      minX = Math.min(minX, (n.x ?? 0) - r);
      minY = Math.min(minY, (n.y ?? 0) - r);
      maxX = Math.max(maxX, (n.x ?? 0) + r);
      maxY = Math.max(maxY, (n.y ?? 0) + r);
    }
    const pad = 48;
    const w = widthRef.current;
    const k = clamp(
      Math.min((w - pad * 2) / Math.max(1, maxX - minX), (heightRef.current - BOTTOM_CHROME - pad * 2) / Math.max(1, maxY - minY)),
      MIN_ZOOM,
      MAX_ZOOM
    );
    setTransform({
      k,
      x: w / 2 - ((minX + maxX) / 2) * k,
      y: (heightRef.current - BOTTOM_CHROME) / 2 - ((minY + maxY) / 2) * k,
    });
  }, []);

  function handlePointerDown(node: SimNode, e: React.PointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    draggingRef.current = node;
    simulationRef.current?.alphaTarget(0.3).restart();
    const p = toGraphPoint(e.clientX, e.clientY);
    node.fx = p.x;
    node.fy = p.y;
  }

  function handlePointerMove(e: React.PointerEvent) {
    const node = draggingRef.current;
    if (!node) return;
    const p = toGraphPoint(e.clientX, e.clientY);
    node.fx = p.x;
    node.fy = p.y;
  }

  function handlePointerUp() {
    const node = draggingRef.current;
    if (!node) return;
    node.fx = null;
    node.fy = null;
    draggingRef.current = null;
    simulationRef.current?.alphaTarget(0);
  }

  const connectionsByNodeId = useMemo(() => {
    const map = new Map<string, NetworkNode[]>();
    if (!data) return map;
    const byId = new Map(data.nodes.map((n) => [n.id, n]));
    for (const edge of data.edges) {
      const a = byId.get(edge.source);
      const b = byId.get(edge.target);
      if (!a || !b) continue;
      if (!map.has(a.id)) map.set(a.id, []);
      if (!map.has(b.id)) map.set(b.id, []);
      map.get(a.id)!.push(b);
      map.get(b.id)!.push(a);
    }
    return map;
  }, [data]);

  const selectedNode = useMemo(
    () => data?.nodes.find((n) => n.id === selectedId) ?? null,
    [data, selectedId]
  );

  return (
    <div className="card-elevated flex h-full flex-col overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-2 px-5 pb-3 pt-4">
        <div>
          <h3 className="text-sm font-bold">Vendor Network</h3>
          <p className="text-[11px] text-muted-foreground">
            Connections between companies, directors and shareholders. Drag to rearrange, click to
            inspect.
          </p>
        </div>
        <label className="sr-only" htmlFor="network-filter">
          Relationship filter
        </label>
        <select
          id="network-filter"
          value={filter}
          onChange={(e) => setFilter(e.target.value as RelationshipFilter)}
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium outline-none transition-colors focus:border-brand/40 focus:ring-2 focus:ring-brand/[0.15]"
        >
          {(Object.keys(FILTER_LABELS) as RelationshipFilter[]).map((key) => (
            <option key={key} value={key}>
              {FILTER_LABELS[key]}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="graph-canvas mx-3 mb-3 flex min-h-[440px] flex-1 items-center justify-center rounded-lg text-sm text-muted-foreground">
          Loading network...
        </div>
      ) : isError || !data ? (
        <div className="mx-3 mb-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          The network could not be loaded.
        </div>
      ) : data.nodes.length === 0 ? (
        <div className="mx-3 mb-3 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No vendor relationships to visualize yet - add directors or shareholders via Intake &amp;
          Extraction.
        </div>
      ) : (
        <div
          ref={containerRef}
          className="graph-canvas relative mx-3 mb-3 min-h-[440px] flex-1 overflow-hidden rounded-lg border border-border/60"
        >
          {/* Floating legend */}
          <div className="absolute left-3 top-3 z-10 space-y-1.5 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-[11px] shadow-sm backdrop-blur-md">
            {LEGEND.map(({ kind, label }) => (
              <div key={kind} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: NODE_COLOR[kind] }} />
                <span className="font-medium text-foreground/80">{label}</span>
              </div>
            ))}
          </div>

          {/* Risk ring legend */}
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-2.5 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 text-[10px] shadow-sm backdrop-blur-md">
            <span className="font-semibold text-muted-foreground">Company risk</span>
            {RISK_TIER_ORDER.map((tier) => (
              <span key={tier} className="flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full border-2 bg-transparent"
                  style={{ borderColor: RISK_TIERS[tier].hex }}
                />
                <span className="text-foreground/80">{RISK_TIERS[tier].label}</span>
              </span>
            ))}
          </div>

          {/* Floating control pill */}
          <div className="absolute bottom-3 right-3 z-10 flex items-center gap-0.5 rounded-full border border-border/60 bg-background/80 p-1 shadow-md backdrop-blur-md">
            <GraphControl label="Zoom out" onClick={() => zoomBy(1 / 1.25)} disabled={transform.k <= MIN_ZOOM}>
              <Minus size={14} />
            </GraphControl>
            <span className="w-10 select-none text-center text-[10px] font-semibold tabular-nums text-muted-foreground">
              {Math.round(transform.k * 100)}%
            </span>
            <GraphControl label="Zoom in" onClick={() => zoomBy(1.25)} disabled={transform.k >= MAX_ZOOM}>
              <Plus size={14} />
            </GraphControl>
            <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />
            <GraphControl label="Fit view" onClick={fitView}>
              <Maximize2 size={13} />
            </GraphControl>
          </div>

          <svg
            ref={svgRef}
            width={width}
            height={height}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onClick={() => setSelectedId(null)}
            // Absolutely positioned so the SVG never contributes to the
            // canvas's measured size - otherwise height would only ratchet up.
            className="absolute inset-0 block touch-none"
          >
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
              <g>
                {simLinksRef.current.map((link, i) => {
                  const source = link.source;
                  const target = link.target;
                  if (!isSimNode(source) || !isSimNode(target)) return null;
                  const touchesSelection =
                    selectedId !== null && (source.id === selectedId || target.id === selectedId);
                  return (
                    <line
                      key={i}
                      x1={source.x ?? 0}
                      y1={source.y ?? 0}
                      x2={target.x ?? 0}
                      y2={target.y ?? 0}
                      stroke={touchesSelection ? BRAND_RED : "hsl(var(--graph-link))"}
                      strokeWidth={touchesSelection ? 2 : 1.25}
                      strokeOpacity={touchesSelection ? 0.7 : 1}
                    />
                  );
                })}
              </g>
              <g>
                {simNodesRef.current.map((node) => {
                  const r = NODE_RADIUS[node.kind];
                  const isSelected = selectedId === node.id;
                  const labelWidth = node.label.length * LABEL_CHAR_WIDTH;
                  const flipLabel = (node.x ?? 0) + r + 7 + labelWidth > width;
                  const risk = node.kind === "company" ? riskByVendorId.get(node.vendorId) : undefined;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                      onPointerDown={(e) => handlePointerDown(node, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedId(node.id);
                      }}
                      className="cursor-pointer"
                    >
                      {isSelected && (
                        <>
                          <circle r={r + 11} fill="none" stroke={BRAND_RED} strokeWidth={3} opacity={0.22} />
                          <circle r={r + 7} fill="none" stroke={BRAND_RED} strokeWidth={3} />
                        </>
                      )}
                      {risk && (
                        <circle
                          r={r + 3.5}
                          fill="none"
                          stroke={RISK_TIERS[risk.tier].hex}
                          strokeWidth={2.5}
                          strokeDasharray={risk.tier === "unassessed" ? "3 2.5" : undefined}
                        />
                      )}
                      <circle
                        r={r}
                        fill={NODE_COLOR[node.kind]}
                        stroke="hsl(var(--graph-canvas))"
                        strokeWidth={2}
                      />
                      <text
                        x={flipLabel ? -(r + 7) : r + 7}
                        y={4}
                        textAnchor={flipLabel ? "end" : "start"}
                        fontSize={11}
                        className="select-none fill-foreground font-medium"
                      >
                        {node.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            </g>
          </svg>

          {/* Inspector overlays the canvas only while something is selected,
              so the graph keeps its full width the rest of the time. */}
          {selectedNode && (
            <div className="card-elevated absolute bottom-14 right-3 top-3 z-20 flex w-72 max-w-[calc(100%-1.5rem)] flex-col overflow-hidden">
              <div aria-hidden="true" className="h-1 shrink-0 bg-brand" />
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Close details"
                className="absolute right-2 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X size={14} />
              </button>
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pr-8">
                <NodeDetailPanel
                  node={selectedNode}
                  connections={connectionsByNodeId.get(selectedNode.id) ?? []}
                  risk={
                    selectedNode.kind === "company"
                      ? riskByVendorId.get(selectedNode.vendorId)
                      : undefined
                  }
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GraphControl({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-brand/[0.12] hover:text-brand disabled:pointer-events-none disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function PanelHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </div>
  );
}

function NodeDetailPanel({
  node,
  connections,
  risk,
}: {
  node: NetworkNode;
  connections: NetworkNode[];
  risk?: VendorRisk;
}) {
  if (node.kind === "company") {
    const status = STATUS_BADGE[node.status] ?? STATUS_BADGE.draft;
    const tier = risk ? RISK_TIERS[risk.tier] : null;
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-brand/[0.12]"
              style={{ backgroundColor: NODE_COLOR.company }}
            />
            <h3 className="text-sm font-bold leading-tight">{node.label}</h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge dot variant={status.variant}>
              {status.label}
            </Badge>
            {tier && (
              <Badge dot variant={tier.badge}>
                {risk?.score !== null && risk?.score !== undefined ? `${risk.score} · ` : ""}
                {tier.label} risk
              </Badge>
            )}
            {node.registrationNo && <Badge variant="outline">BRN {node.registrationNo}</Badge>}
          </div>
          {risk && risk.findingCount > 0 && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {risk.findingCount} triage finding{risk.findingCount === 1 ? "" : "s"},{" "}
              {risk.openFindingCount} still open
            </p>
          )}
        </div>

        <Link
          to={`/vendor/${node.vendorId}`}
          className="inline-flex items-center gap-1 rounded-md bg-brand/[0.08] px-2.5 py-1.5 text-xs font-semibold text-brand transition-colors hover:bg-brand/[0.15]"
        >
          Open vendor profile →
        </Link>

        <div className="border-t border-border pt-3">
          <PanelHeading>Connected people ({connections.length})</PanelHeading>
          {connections.length === 0 ? (
            <p className="text-xs text-muted-foreground">None captured yet.</p>
          ) : (
            <ul className="space-y-2">
              {connections.map((c) => {
                if (c.kind === "company") return null;
                const person = c as PersonNode;
                const role = person.roles.find((r) => r.vendorId === node.vendorId);
                const isDirector = role?.role === "director";
                return (
                  <li key={c.id} className="flex items-center gap-2.5">
                    <InitialsAvatar name={c.label} tone={isDirector ? "warning" : "success"} size="sm" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-semibold">{c.label}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {isDirector ? role?.designation ?? "Director" : "Shareholder"}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    );
  }

  const person = node as PersonNode;
  const isDirector = person.kind === "director";
  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-start gap-2.5">
          <InitialsAvatar name={person.label} tone={isDirector ? "warning" : "success"} size="md" />
          <h3 className="min-w-0 text-sm font-bold leading-tight">{person.label}</h3>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge dot variant={isDirector ? "warning" : "success"}>
            {isDirector ? "Director" : "Shareholder"}
          </Badge>
          {person.icPassportNo && <Badge variant="outline">{person.icPassportNo}</Badge>}
        </div>
      </div>

      {person.linkedCompanyCount > 1 && (
        <div className="rounded-lg border border-warning/25 bg-warning/[0.12] px-3 py-2 text-[11px] font-medium leading-snug text-warning">
          ⚠ Linked to {person.linkedCompanyCount} companies
          {!person.icPassportNo && " by matching name only"} — verify this is the same individual
          before relying on the connection.
        </div>
      )}

      <div className="border-t border-border pt-3">
        <PanelHeading>Companies ({person.roles.length})</PanelHeading>
        <ul className="space-y-2.5">
          {person.roles.map((role, i) => (
            <li key={i}>
              <Link to={`/vendor/${role.vendorId}`} className="text-xs font-semibold text-brand hover:underline">
                {role.vendorName}
              </Link>
              <div className="mt-1">
                <Badge variant="outline">
                  {role.role === "director"
                    ? role.designation ?? "Director"
                    : `Shareholder${role.totalShares ? ` · ${Number(role.totalShares).toLocaleString()} shares` : ""}`}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
