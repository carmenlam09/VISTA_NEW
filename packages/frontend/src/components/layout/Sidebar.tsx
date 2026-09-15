import { Moon, PanelLeftClose, PanelLeftOpen, ShieldCheck, Sun } from "lucide-react";
import { useState } from "react";
import { MODULES } from "shared-types";
import { NavLink, useParams } from "react-router-dom";

import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const COLLAPSED_STORAGE_KEY = "vista-sidebar-collapsed";

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

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
        // One continuous charcoal column for the full viewport height - the
        // brand lockup sits on the same ground as the nav rather than in a
        // separate coloured header block, which reads as a single piece of
        // app chrome instead of two stacked bars.
        "flex h-full shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Brand masthead. The bank's name is no longer spelled out here, so
          the OCBC identity is carried entirely by colour: a red wash behind
          the lockup, the red shield tile, and the red rule closing the
          block off from the navigation. */}
      <div className="relative">
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

        {/* Brand rule closing the masthead - solid at the leading edge and
            fading out, so it frames the lockup without boxing it in. */}
        <div
          aria-hidden="true"
          className="h-0.5 bg-gradient-to-r from-brand via-brand/60 to-brand/10"
        />
      </div>

      <div className="flex-1 space-y-0.5 px-2 pt-3">
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

          const label = collapsed ? (
            <span className="mx-auto text-[10px] font-semibold">M{module.moduleNumber}</span>
          ) : (
            <>
              <span className="truncate">{module.label}</span>
              <span className="ml-2 shrink-0 text-[10px] font-normal opacity-50">
                M{module.moduleNumber}
              </span>
            </>
          );

          // The active marker is a 4px brand-red rule on the leading edge.
          // It's painted as a transparent border on every item (not added
          // only when active) so the label never shifts by 4px on select.
          const base = cn(
            "flex items-center justify-between rounded-r-md border-l-4 py-2 text-sm font-medium transition-colors",
            collapsed ? "justify-center px-1" : "pl-3 pr-3"
          );

          return to ? (
            <NavLink
              key={module.slug}
              to={to}
              title={collapsed ? module.label : undefined}
              className={({ isActive }) =>
                cn(
                  base,
                  isActive
                    ? "border-l-brand bg-brand/[0.12] font-semibold text-white"
                    : "border-l-transparent text-sidebar-foreground/90 hover:bg-sidebar-raised hover:text-white"
                )
              }
              end
            >
              {label}
            </NavLink>
          ) : (
            <div
              key={module.slug}
              title={collapsed ? module.label : "Select a vendor to open this module"}
              className={cn(base, "pointer-events-none border-l-transparent text-sidebar-muted/50")}
            >
              {label}
            </div>
          );
        })}
      </div>

      <div className="border-t border-brand/25 px-2 py-3">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-sidebar-muted transition-colors hover:bg-sidebar-raised hover:text-white",
            collapsed ? "mx-auto justify-center px-1.5" : "w-full"
          )}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          {!collapsed && (theme === "dark" ? "Light mode" : "Dark mode")}
        </button>
      </div>
    </nav>
  );
}
