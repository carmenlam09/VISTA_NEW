import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

// Filled buttons go flat grey when disabled rather than a faded tint: at 50%
// opacity the brand red reads as a washed-out pink that still looks pressable,
// which matters here because "Confirm & Save" uses the disabled state to mean
// "already saved, nothing to do" - that has to be unmistakably inert.
const DISABLED_FILL =
  "disabled:bg-muted disabled:text-muted-foreground/70 disabled:shadow-none";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none",
  {
    variants: {
      variant: {
        default: `bg-primary text-primary-foreground shadow hover:bg-primary/90 ${DISABLED_FILL}`,
        destructive: `bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 ${DISABLED_FILL}`,
        outline:
          "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
        ghost: "hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
        secondary:
          `bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 ${DISABLED_FILL}`,
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
