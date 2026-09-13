import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  gradient,
  wash,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  detail?: string;
  /** Tailwind gradient stops for the icon badge, e.g. "from-indigo-500 to-blue-600". */
  gradient: string;
  /** Very light tinted card background, e.g. "bg-indigo-50/60". */
  wash: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        wash
      )}
    >
      <Icon
        aria-hidden="true"
        strokeWidth={1.5}
        className="pointer-events-none absolute -right-4 -top-4 h-28 w-28 text-foreground/[0.04] transition-transform duration-300 group-hover:scale-110"
      />
      <div
        className={cn(
          "relative mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md",
          gradient
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
