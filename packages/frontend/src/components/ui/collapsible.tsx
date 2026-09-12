import { useState } from "react";

import { cn } from "@/lib/utils";

export function Collapsible({
  title,
  defaultOpen = false,
  badge,
  children,
}: {
  title: React.ReactNode;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {title}
          {badge}
        </span>
        <span
          className={cn("text-xs text-muted-foreground transition-transform", open && "rotate-180")}
        >
          ▾
        </span>
      </button>
      {open && <div className="border-t border-border p-4">{children}</div>}
    </div>
  );
}
