import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

import { useDashboardOverview } from "@/hooks/useDashboardOverview";
import { cn } from "@/lib/utils";

// Every query the dashboard renders from, so one refresh reloads the page.
const DASHBOARD_QUERY_KEYS = [
  ["dashboard-overview"],
  ["dashboard-stats"],
  ["dashboard-network"],
  ["vendors"],
];

function greeting(now: Date) {
  const h = now.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function WelcomeBanner({ userName }: { userName: string }) {
  const queryClient = useQueryClient();
  const { dataUpdatedAt } = useDashboardOverview();
  const refreshing =
    useIsFetching({
      predicate: (q) => DASHBOARD_QUERY_KEYS.some((k) => k[0] === q.queryKey[0]),
    }) > 0;

  function refresh() {
    for (const queryKey of DASHBOARD_QUERY_KEYS) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }

  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div className="mb-2 h-1 w-12 rounded-full bg-brand" />
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {greeting(new Date())}, <span className="text-brand">{userName}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here&apos;s what&apos;s happening with your vendor risk landscape today.
        </p>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        {dataUpdatedAt > 0 && (
          <span>
            Last updated{" "}
            <time dateTime={new Date(dataUpdatedAt).toISOString()} className="font-semibold text-foreground">
              {new Date(dataUpdatedAt).toLocaleString(undefined, {
                hour: "numeric",
                minute: "2-digit",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </time>
          </span>
        )}
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          aria-label="Refresh dashboard"
          title="Refresh dashboard"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/30 text-brand transition-colors hover:bg-brand/10 disabled:opacity-60"
        >
          <RefreshCw size={14} className={cn(refreshing && "animate-spin")} />
        </button>
      </div>
    </div>
  );
}
