import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow-subtle hover:bg-primary/90",
        secondary: "border-border bg-surface-muted text-secondary-foreground hover:bg-border/60",
        destructive: "border-nobid/30 bg-nobid-soft text-nobid font-semibold",
        outline: "border-border text-foreground bg-surface",
        bid: "border-bid/30 bg-bid-soft text-bid font-bold",
        review: "border-review/30 bg-review-soft text-review font-bold",
        nobid: "border-nobid/30 bg-nobid-soft text-nobid font-bold",
        info: "border-primary/25 bg-primary-soft text-primary font-medium",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
