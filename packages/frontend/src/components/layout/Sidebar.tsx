import {
  FileSearch,
  FileText,
  LayoutDashboard,
  Library,
  ListChecks,
  Moon,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  ScanSearch,
  ShieldCheck,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { MODULES, type ModuleSlug } from "shared-types";
import { NavLink, useParams } from "react-router-dom";

import { InitialsAvatar } from "@/components/ui/initials-avatar";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

import { RiskGauge } from "./RiskGauge";

const COLLAPSED_STORAGE_KEY = "vista-sidebar-collapsed";

const MODULE_ICONS: Record<ModuleSlug, LucideIcon> = {
  intake: FileSearch,
  screening: ScanSearch,
  "adverse-media": Newspaper,
  triage: ListChecks,
  "kyv-report": FileText,
  "knowledge-repository": Library,
};

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

// The active marker is a 4px brand-red rule on the leading edge. It's painted
// as a transparent border on every item (not added only when active) so the
// label never shifts by 4px on select.
function navItemClasses(collapsed: boolean) {
  return cn(
    "flex items-center gap-3 rounded-r-md border-l-4 py-2 text-sm font-medium transition-colors",
    collapsed ? "justify-center px-1" : "pl-3 pr-3"
  );
}

const ACTIVE = "border-l-brand bg-brand/[0.12] font-semibold text-white";
const IDLE =
  "border-l-transparent text-sidebar-foreground/90 hover:bg-sidebar-raised hover:text-white";

export function Sidebar() {
  const { vendorId } = useParams<{ vendorId: string }>();
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);
  const { theme, toggleTheme } = useTheme();

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Purely a remembered preference - fine to skip if storage is unavailable.
      }
      return next;
    });
  }

  return (
    <nav
      className={cn(
        "flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand masthead - identity carried by colour: red wash, red shield
          tile, and a red rule closing the block off from the navigation. */}
      <div className="relative shrink-0">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand/30 via-brand/[0.07] to-transparent"
        />
        <div
          className={cn(
            "relative flex gap-3",
            collapsed ? "flex-col items-center px-2 py-4" : "items-center px-4 py-5"
          )}
        >
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-lg shadow-brand/40 ring-1 ring-white/20"
          >
            <ShieldCheck size={20} strokeWidth={2.25} />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 text-2xl font-extrabold leading-none tracking-tight text-white">
              VISTA
            </div>
          )}
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-sidebar-raised hover:text-white"
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        </div>
        {!collapsed && (
          <div className="relative px-4 pb-4 text-[10px] font-medium leading-snug text-sidebar-muted">
            Vendor Intelligence Screening &amp; Trust Assessment
          </div>
        )}
        <div
          aria-hidden="true"
          className="h-0.5 bg-gradient-to-r from-brand via-brand/60 to-brand/10"
        />
      </div>

      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pt-3">
        <NavLink
          to="/"
          end
          title={collapsed ? "Dashboard" : undefined}
          className={({ isActive }) => cn(navItemClasses(collapsed), isActive ? ACTIVE : IDLE)}
        >
          <LayoutDashboard size={17} className="shrink-0" />
          {!collapsed && <span className="truncate">Dashboard</span>}
        </NavLink>

        {!collapsed && (
          <div className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-sidebar-muted/80">
            {vendorId ? "Vendor review" : "Modules"}
          </div>
        )}

        {MODULES.map((module) => {
          // Unlike every other module, the Knowledge Repository searches
          // across all vendors - it's never vendor-scoped, so it's always
          // reachable regardless of whether a vendor is currently selected.
          const to =
            module.slug === "knowledge-repository"
              ? "/knowledge-repository"
              : vendorId
                ? `/vendor/${vendorId}/${module.slug}`
                : null;
          const Icon = MODULE_ICONS[module.slug];

          const content = (
            <>
              <Icon size={17} className="shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 truncate">{module.label}</span>
                  <span className="shrink-0 text-[10px] font-normal opacity-50">
                    M{module.moduleNumber}
                  </span>
                </>
              )}
            </>
          );

          return to ? (
            <NavLink
              key={module.slug}
              to={to}
              title={collapsed ? module.label : undefined}
              className={({ isActive }) => cn(navItemClasses(collapsed), isActive ? ACTIVE : IDLE)}
              end
            >
              {content}
            </NavLink>
          ) : (
            <div
              key={module.slug}
              title={`${module.label} - open a vendor first`}
              className={cn(
                navItemClasses(collapsed),
                "cursor-not-allowed border-l-transparent text-sidebar-muted/60"
              )}
            >
              {content}
            </div>
          );
        })}
      </div>

      {!collapsed && (
        <div className="shrink-0 pt-3">
          <RiskGauge />
        </div>
      )}

      <div className="shrink-0 space-y-1 border-t border-brand/25 px-2 py-3">
        <button
          type="button"
          role="switch"
          aria-checked={theme === "dark"}
          onClick={toggleTheme}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className={cn(
            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-sidebar-muted transition-colors hover:bg-sidebar-raised hover:text-white",
            collapsed && "justify-center px-1.5"
          )}
        >
          {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Dark mode</span>
              <span
                aria-hidden="true"
                className={cn(
                  "relative h-4 w-7 rounded-full transition-colors",
                  theme === "dark" ? "bg-brand" : "bg-sidebar-border"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
                    theme === "dark" ? "translate-x-3.5" : "translate-x-0.5"
                  )}
                />
              </span>
            </>
          )}
        </button>

        <div
          className={cn("flex items-center gap-2.5 rounded-md px-2 py-1.5", collapsed && "justify-center px-0")}
          title={collapsed ? "Default Reviewer" : undefined}
        >
          <InitialsAvatar name="Default Reviewer" tone="brand" size="md" />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-xs font-semibold text-white">Default Reviewer</div>
              <div className="text-[10px] text-sidebar-muted">Reviewer</div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
