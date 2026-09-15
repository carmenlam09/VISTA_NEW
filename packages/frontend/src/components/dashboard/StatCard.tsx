import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";

import { formatDelta } from "@/lib/risk";
import { cn } from "@/lib/utils";

import { Sparkline } from "./Sparkline";

/**
 * Tone maps a metric to its meaning, not to a decorative colour: brand for
 * the headline portfolio count, warning for queues that need action, success
 * for completed work.
 */
const TONE_CLASSES = {
  brand: { badge: "bg-brand/[0.12] text-brand", line: "#ED1A2D" },
  info: { badge: "bg-sky-500/[0.14] text-sky-600 dark:text-sky-400", line: "#0EA5E9" },
  warning: { badge: "bg-warning/[0.15] text-warning", line: "#D97706" },
  success: { badge: "bg-success/[0.12] text-success", line: "#00875A" },
} as const;

export type StatTone = keyof typeof TONE_CLASSES;

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  series,
  deltaPct,
  /** Whether a rise in this metric is good news. A growing triage backlog is not. */
  riseIsGood = true,
  trendCaption,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  detail?: string;
  tone: StatTone;
  series?: number[];
  deltaPct?: number | null;
  riseIsGood?: boolean;
  trendCaption?: string;
}) {
  const { badge, line } = TONE_CLASSES[tone];
  const delta = formatDelta(deltaPct ?? null);
  const rising = (deltaPct ?? 0) > 0;
  // Colour the delta by whether it is *good*, not by its direction.
  const deltaIsPositive = rising === riseIsGood;

  return (
    <div className="card-elevated card-interactive group relative overflow-hidden p-4">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            badge
          )}
        >
          <Icon size={18} strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold text-muted-foreground">{label}</div>
          <div className="mt-0.5 text-3xl font-extrabold leading-none tabular-nums tracking-tight">
            {value}
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0">
          {detail && <div className="truncate text-[11px] text-muted-foreground">{detail}</div>}
          {delta ? (
            <div
              className={cn(
                "mt-1 flex items-center gap-1 text-[11px] font-semibold",
                deltaIsPositive ? "text-success" : "text-destructive"
              )}
            >
              {rising ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {delta}
              <span className="font-normal text-muted-foreground">vs last month</span>
            </div>
          ) : (
            // No prior-period data to compare against - saying nothing beats
            // inventing a "+100%" off a zero baseline.
            trendCaption && (
              <div className="mt-1 text-[11px] text-muted-foreground">{trendCaption}</div>
            )
          )}
        </div>
        {series && series.length > 1 && (
          <div className="shrink-0">
            <Sparkline series={series} color={line} />
          </div>
        )}
      </div>
    </div>
  );
}
