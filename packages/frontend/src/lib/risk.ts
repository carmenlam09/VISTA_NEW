import type { BadgeProps } from "@/components/ui/badge";
import type { RiskTier } from "@/types/overview";

/**
 * One definition of how each risk tier looks and reads, shared by the gauge,
 * the donut, the vendor table and the alert list - so a "High" vendor is the
 * same word and the same colour everywhere it appears.
 *
 * `unassessed` is a first-class tier, not an error state: a vendor nobody has
 * screened yet is unknown risk, and showing it as "Low" would be misleading.
 */
export const RISK_TIERS: Record<
  RiskTier,
  { label: string; badge: BadgeProps["variant"]; hex: string; text: string }
> = {
  high: { label: "High", badge: "destructive", hex: "#ED1A2D", text: "text-destructive" },
  medium: { label: "Medium", badge: "warning", hex: "#D97706", text: "text-warning" },
  low: { label: "Low", badge: "success", hex: "#00875A", text: "text-success" },
  unassessed: {
    label: "Not assessed",
    badge: "outline",
    hex: "#94A3B8",
    text: "text-muted-foreground",
  },
};

/** Tiers in the order they should be listed, most severe first. */
export const RISK_TIER_ORDER: RiskTier[] = ["high", "medium", "low", "unassessed"];

export function formatDelta(deltaPct: number | null): string | null {
  if (deltaPct === null || deltaPct === 0) return null;
  return `${deltaPct > 0 ? "+" : ""}${deltaPct}%`;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}
