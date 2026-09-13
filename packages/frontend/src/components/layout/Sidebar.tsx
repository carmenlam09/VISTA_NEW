import { PanelLeftClose, PanelLeftOpen, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { MODULES } from "shared-types";
import { NavLink, useParams } from "react-router-dom";

import { cn } from "@/lib/utils";

const itemClasses =
  "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors";

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
        "flex h-full shrink-0 flex-col border-r border-border bg-secondary/30 transition-[width] duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className={cn("flex gap-3 px-3 py-5", collapsed ? "flex-col items-center" : "items-center")}>
        <div
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30"
        >
          <ShieldCheck size={20} strokeWidth={2.25} />
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="text-2xl font-extrabold tracking-tight text-foreground">VISTA</div>
            <div className="text-[10px] font-medium leading-tight text-muted-foreground">
              Vendor Intelligence Screening &amp; Trust Assessment
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      <div className="flex-1 space-y-1 px-2">
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
            <span className="mx-auto text-[10px] font-semibold opacity-70">
              M{module.moduleNumber}
            </span>
          ) : (
            <>
              <span>{module.label}</span>
              <span className="text-[10px] font-normal opacity-60">M{module.moduleNumber}</span>
            </>
          );

          return to ? (
            <NavLink
              key={module.slug}
              to={to}
              title={collapsed ? module.label : undefined}
              className={({ isActive }) =>
                cn(
                  itemClasses,
                  collapsed && "justify-center px-2",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                )
              }
              end
            >
              {label}
            </NavLink>
          ) : (
            <div
              key={module.slug}
              title={collapsed ? module.label : undefined}
              className={cn(
                itemClasses,
                collapsed && "justify-center px-2",
                "pointer-events-none text-foreground/40"
              )}
            >
              {label}
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        {collapsed ? (
          <span className="block text-center" title="Logged in as Default Reviewer">
            DR
          </span>
        ) : (
          <>
            Logged in as <span className="font-medium text-foreground">Default Reviewer</span>
          </>
        )}
      </div>
    </nav>
  );
}
