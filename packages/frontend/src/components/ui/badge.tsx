import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// Status pills use a soft tint + saturated text + hairline border rather
// than a solid fill: at this size a solid block of colour competes with the
// data, and the tinted form keeps risk colours legible against both the
// light and dark grounds (every colour here is a theme token, so dark mode
// gets its own tuned value instead of a washed-out light-mode swatch).
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-normal transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground",
        brand: "border-brand/25 bg-brand/10 text-brand",
        warning: "border-warning/25 bg-warning/[0.15] text-warning",
        success: "border-success/25 bg-success/10 text-success",
        destructive: "border-destructive/25 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Renders a small filled dot in the badge's own colour, for status pills. */
  dot?: boolean;
}

function Badge({ className, variant, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot && (
        <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
      )}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
