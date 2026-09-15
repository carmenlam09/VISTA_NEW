import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { Maximize2, Minus, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { Badge, type BadgeProps } from "@/components/ui/badge";
import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { useNetworkGraph } from "@/hooks/useNetworkGraph";
import type { NetworkNode, PersonNode } from "@/types/network";

type SimNode = NetworkNode & SimulationNodeDatum;
type SimLink = SimulationLinkDatum<SimNode>;

// Fixed hexes rather than theme tokens: these encode what a node *is*, so
// they must stay stable across themes. They sit on a controlled canvas
// colour, so contrast is predictable in both. Company is OCBC red.
const BRAND_RED = "#ED1A2D";
const NODE_COLOR: Record<NetworkNode["kind"], string> = {
  company: BRAND_RED,
  director: "#D97706",
  shareholder: "#00875A",
};

const NODE_RADIUS: Record<NetworkNode["kind"], number> = {
  company: 16,
  director: 11,
  shareholder: 11,
};

const LEGEND: { kind: NetworkNode["kind"]; label: string }[] = [
  { kind: "company", label: "Company" },
  { kind: "shareholder", label: "Shareholder" },
  { kind: "director", label: "Director" },
];

const STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  draft: { variant: "secondary", label: "Draft" },
  in_review: { variant: "warning", label: "In Review" },
  approved: { variant: "success", label: "Approved" },
  rejected: { variant: "destructive", label: "Rejected" },
};

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

export function NetworkGraph() {
  const { data, isLoading, isError } = useNetworkGraph();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(900);
  const height = 520;
  const widthRef = useRef(width);
  widthRef.current = width;
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.max(320, entry.contentRect.width));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!data) return;

    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const links: SimLink[] = data.edges
      .filter((e) => nodeById.has(e.source) && nodeById.has(e.target))
      .map((e) => ({ source: e.source, target: e.target }));

    simNodesRef.current = nodes;
    simLinksRef.current = links;

    const simulation = forceSimulation(nodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(links)
          .id((d) => d.id)
          .distance(95)
          .strength(0.55)
      )
      .force("charge", forceManyBody().strength(-260))
      .force("center", forceCenter(width / 2, height / 2))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => NODE_RADIUS[d.kind] + 30)
      )
      .on("tick", () => {
        // Isolated nodes (no edges at all, e.g. a vendor with no directors/
        // shareholders captured yet) have nothing pulling them toward
        // center, so unbounded repulsion can push them outside the visible
        // canvas - clamp every node to stay within it each tick.
        const w = widthRef.current;
        for (const n of nodes) {
          const r = NODE_RADIUS[n.kind];
          n.x = Math.max(r, Math.min(w - r, n.x ?? w / 2));
          n.y = Math.max(r, Math.min(height - r, n.y ?? height / 2));
        }
        forceRerender((t) => t + 1);
      });

    simulationRef.current = simulation;
    return () => {
      simulation.stop();
      simulationRef.current = null;
    };
    // Deliberately only re-run when the fetched data itself changes - width
    // changes are handled by the separate effect below via force("center").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    const sim = simulationRef.current;
    if (!sim) return;
    sim.force("center", forceCenter(width / 2, height / 2));
    sim.alpha(0.3).restart();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width]);

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
      const cy = height / 2;
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
    const boundsW = Math.max(1, maxX - minX);
    const boundsH = Math.max(1, maxY - minY);
    const k = clamp(
      Math.min((w - pad * 2) / boundsW, (height - pad * 2) / boundsH),
      MIN_ZOOM,
      MAX_ZOOM
    );
    setTransform({
      k,
      x: w / 2 - ((minX + maxX) / 2) * k,
      y: height / 2 - ((minY + maxY) / 2) * k,
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

  // Which nodes each node connects to, for the detail panel - derived from
  // the stable fetched data, not the mutable sim copy (position doesn't
  // matter here, only relationships do).
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

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading network...</p>;
  }
  if (isError || !data) {
    return null; // Non-critical - the rest of the dashboard still works without it.
  }
  if (data.nodes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        No vendor relationships to visualize yet - add directors or shareholders via Intake &amp;
        Extraction.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <div
        ref={containerRef}
        className="graph-canvas card-elevated relative min-w-0 flex-1 overflow-hidden"
        style={{ height }}
      >
        {/* Floating legend */}
        <div className="absolute left-3 top-3 z-10 space-y-1.5 rounded-xl border border-border/60 bg-background/80 px-3 py-2.5 text-xs shadow-sm backdrop-blur-md">
          {LEGEND.map(({ kind, label }) => (
            <div key={kind} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: NODE_COLOR[kind] }}
              />
              <span className="font-medium text-foreground/80">{label}</span>
            </div>
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
          className="block touch-none"
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
                    strokeWidth={touchesSelection ? 2 : 1.5}
                    strokeOpacity={touchesSelection ? 0.55 : 1}
                  />
                );
              })}
            </g>
            <g>
              {simNodesRef.current.map((node) => {
                const r = NODE_RADIUS[node.kind];
                const isSelected = selectedId === node.id;
                // Flip a label to the node's left only when drawing it on
                // the right would actually overflow the clipped canvas -
                // flipping on a blanket x-threshold instead moves labels
                // that had room and makes them collide with their neighbours.
                const labelWidth = node.label.length * LABEL_CHAR_WIDTH;
                const flipLabel = (node.x ?? 0) + r + 7 + labelWidth > width;
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x ?? 0}, ${node.y ?? 0})`}
                    onPointerDown={(e) => handlePointerDown(node, e)}
                    onClick={() => setSelectedId(node.id)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <>
                        {/* Soft halo, then the crisp ring - the canvas-coloured
                            gap between node and ring is what keeps the marker
                            visible even on a red company node. */}
                        <circle
                          r={r + 9}
                          fill="none"
                          stroke={BRAND_RED}
                          strokeWidth={3}
                          opacity={0.22}
                        />
                        <circle
                          r={r + 4.5}
                          fill="none"
                          stroke={BRAND_RED}
                          strokeWidth={3}
                        />
                      </>
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
      </div>

      {/* Inspector - its own elevated card with a brand accent along the top. */}
      <div className="card-elevated w-full shrink-0 overflow-hidden lg:w-80">
        <div aria-hidden="true" className="h-1 bg-brand" />
        <div className="max-h-[calc(520px-4px)] overflow-y-auto p-5">
          {selectedNode ? (
            <NodeDetailPanel
              node={selectedNode}
              connections={connectionsByNodeId.get(selectedNode.id) ?? []}
            />
          ) : (
            <>
              <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Network Details
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Select a node to view relationship details.
              </p>
            </>
          )}
        </div>
      </div>
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
}: {
  node: NetworkNode;
  connections: NetworkNode[];
}) {
  if (node.kind === "company") {
    const status = STATUS_BADGE[node.status] ?? STATUS_BADGE.draft;
    return (
      <div className="space-y-4">
        <div>
          <div className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className="mt-1 h-3 w-3 shrink-0 rounded-full ring-4 ring-brand/[0.12]"
              style={{ backgroundColor: NODE_COLOR.company }}
            />
            <h3 className="text-base font-bold leading-tight">{node.label}</h3>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge dot variant={status.variant}>
              {status.label}
            </Badge>
            {node.registrationNo && (
              <Badge variant="outline">BRN {node.registrationNo}</Badge>
            )}
          </div>
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
                    <InitialsAvatar
                      name={c.label}
                      tone={isDirector ? "warning" : "success"}
                      size="sm"
                    />
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
          <InitialsAvatar
            name={person.label}
            tone={isDirector ? "warning" : "success"}
            size="md"
          />
          <div className="min-w-0">
            <h3 className="text-base font-bold leading-tight">{person.label}</h3>
          </div>
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
              <Link
                to={`/vendor/${role.vendorId}`}
                className="text-xs font-semibold text-brand hover:underline"
              >
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
