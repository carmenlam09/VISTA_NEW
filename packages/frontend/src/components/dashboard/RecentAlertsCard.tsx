import { AlertOctagon, AlertTriangle, FileClock, type LucideIcon } from "lucide-react";

import { formatRelativeTime } from "@/lib/risk";
import { cn } from "@/lib/utils";
import type { DashboardAlert } from "@/types/overview";

const SEVERITY: Record<DashboardAlert["severity"], { icon: LucideIcon; classes: string }> = {
  high: { icon: AlertOctagon, classes: "bg-destructive/10 text-destructive" },
  medium: { icon: AlertTriangle, classes: "bg-warning/[0.15] text-warning" },
  low: { icon: FileClock, classes: "bg-brand/10 text-brand" },
};

export function RecentAlertsCard({ alerts }: { alerts: DashboardAlert[] }) {
  return (
    <div className="card-elevated flex h-full flex-col p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Recent Alerts</h3>
        {alerts.length > 0 && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
            {alerts.length} open
          </span>
        )}
      </div>

      {alerts.length === 0 ? (
        <p className="mt-6 text-center text-xs text-muted-foreground">
          No open alerts — every queue is clear.
        </p>
      ) : (
        <ul className="mt-3 -mx-1 flex-1 space-y-0.5 overflow-y-auto">
          {alerts.map((alert) => {
            const { icon: Icon, classes } = SEVERITY[alert.severity];
            return (
              <li
                key={alert.id}
                className="flex items-start gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-brand/[0.06]"
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                    classes
                  )}
                >
                  <Icon size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold">{alert.title}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{alert.detail}</div>
                </div>
                <time
                  dateTime={alert.at}
                  title={new Date(alert.at).toLocaleString()}
                  className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                >
                  {formatRelativeTime(alert.at)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
