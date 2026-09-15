import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Tone maps a metric to its meaning, not to a decorative colour: brand for
 * the headline portfolio count, warning for queues that need action, success
 * for completed work. Each is a theme token, so both themes stay correct.
 */
const TONE_CLASSES = {
  brand: { badge: "bg-brand/[0.12] text-brand", ghost: "text-brand/[0.07]" },
  info: { badge: "bg-sky-500/[0.14] text-sky-600 dark:text-sky-400", ghost: "text-sky-500/[0.07]" },
  warning: { badge: "bg-warning/[0.15] text-warning", ghost: "text-warning/[0.08]" },
  success: { badge: "bg-success/[0.12] text-success", ghost: "text-success/[0.07]" },
} as const;

export type StatTone = keyof typeof TONE_CLASSES;

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  detail?: string;
  tone: StatTone;
}) {
  const { badge, ghost } = TONE_CLASSES[tone];

  return (
    <div className="card-elevated card-interactive group relative overflow-hidden p-5">
      {/* Oversized ghost glyph bleeding off the corner, for depth. */}
      <Icon
        aria-hidden="true"
        strokeWidth={1.5}
        className={cn(
          "pointer-events-none absolute -right-5 -top-5 h-28 w-28 transition-transform duration-300 group-hover:scale-110",
          ghost
        )}
      />
      <div
        className={cn(
          "relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl",
          badge
        )}
      >
        <Icon size={20} strokeWidth={2.25} />
      </div>
      <div className="relative text-3xl font-extrabold tabular-nums tracking-tight text-foreground">
        {value}
      </div>
      <div className="relative mt-1 text-sm font-semibold text-foreground/80">{label}</div>
      {detail && <div className="relative mt-1 text-xs text-muted-foreground">{detail}</div>}
    </div>
  );
}
