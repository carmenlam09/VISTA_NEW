import { MODULES } from "shared-types";
import { Link, NavLink, useParams } from "react-router-dom";

import { cn } from "@/lib/utils";

const itemClasses =
  "flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors";

export function Sidebar() {
  const { vendorId } = useParams<{ vendorId: string }>();

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-secondary/30">
      <Link to="/" className="block px-4 py-5 transition-opacity hover:opacity-80">
        <div className="text-lg font-semibold tracking-tight">VISTA</div>
        <div className="text-xs text-muted-foreground">
          Vendor Intelligence Screening &amp; Trust Assessment
        </div>
      </Link>

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

          return to ? (
            <NavLink
              key={module.slug}
              to={to}
              className={({ isActive }) =>
                cn(
                  itemClasses,
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-accent-foreground"
                )
              }
              end
            >
              <span>{module.label}</span>
              <span className="text-[10px] font-normal opacity-60">
                M{module.moduleNumber}
              </span>
            </NavLink>
          ) : (
            <div
              key={module.slug}
              className={cn(itemClasses, "pointer-events-none text-foreground/40")}
            >
              <span>{module.label}</span>
              <span className="text-[10px] font-normal opacity-60">
                M{module.moduleNumber}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
        Logged in as <span className="font-medium text-foreground">Default Reviewer</span>
      </div>
    </nav>
  );
}
