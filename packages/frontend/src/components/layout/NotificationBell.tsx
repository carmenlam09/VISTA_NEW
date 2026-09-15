import { AlertTriangle, Bell, FileClock, Inbox } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useDashboardStats } from "@/hooks/useDashboardStats";

interface AttentionItem {
  key: string;
  icon: LucideIcon;
  title: string;
  detail: string;
  count: number;
  tone: "warning" | "brand";
}

/**
 * Surfaces the real review queues from the dashboard stats rather than a
 * decorative counter: anything shown here is an item a reviewer actually has
 * to action, so the badge count means something.
 */
export function NotificationBell() {
  const { data: stats } = useDashboardStats();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items: AttentionItem[] = [];
  if (stats) {
    if (stats.triage.byDecision.pending > 0) {
      items.push({
        key: "triage",
        icon: AlertTriangle,
        title: "Adverse media awaiting triage",
        detail: `${stats.triage.byDecision.relevant} already flagged relevant`,
        count: stats.triage.byDecision.pending,
        tone: "warning",
      });
    }
    if (stats.kyvReports.byStatus.pending_checker_review > 0) {
      items.push({
        key: "checker",
        icon: FileClock,
        title: "KYV reports pending checker review",
        detail: `${stats.kyvReports.total} report${stats.kyvReports.total === 1 ? "" : "s"} generated overall`,
        count: stats.kyvReports.byStatus.pending_checker_review,
        tone: "brand",
      });
    }
    if (stats.vendors.byStatus.in_review > 0) {
      items.push({
        key: "in-review",
        icon: Inbox,
        title: "Vendors in review",
        detail: `${stats.vendors.byStatus.draft} still in draft`,
        count: stats.vendors.byStatus.in_review,
        tone: "brand",
      });
    }
  }

  const total = items.reduce((sum, item) => sum + item.count, 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={
          total > 0 ? `Notifications, ${total} items need attention` : "Notifications, nothing pending"
        }
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-colors hover:border-brand/20 hover:bg-brand/[0.08] hover:text-foreground"
      >
        <Bell size={17} />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold leading-none text-brand-foreground ring-2 ring-background">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </button>

      {open && (
        <div className="card-elevated absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden">
          <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Needs attention
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted-foreground">
              Nothing pending — all queues are clear.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {items.map(({ key, icon: Icon, title, detail, count, tone }) => (
                <li key={key} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={
                      tone === "warning"
                        ? "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-warning/[0.15] text-warning"
                        : "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand/[0.12] text-brand"
                    }
                  >
                    <Icon size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold leading-snug">{title}</span>
                    <span className="block text-[11px] text-muted-foreground">{detail}</span>
                  </span>
                  <span className="shrink-0 text-sm font-bold tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
