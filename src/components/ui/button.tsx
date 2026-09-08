import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-subtle hover:bg-primary-bright font-semibold",
        destructive:
          "bg-destructive text-destructive-foreground shadow-subtle hover:opacity-90 font-semibold",
        outline:
          "border border-border bg-surface text-foreground shadow-subtle hover:bg-surface-muted hover:border-border-strong",
        secondary:
          "bg-surface-muted text-foreground border border-border/70 hover:bg-border/60 hover:text-foreground",
        ghost: "hover:bg-surface-muted hover:text-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        bid: "bg-bid text-bid-foreground shadow-subtle hover:opacity-90 font-semibold",
        review: "bg-review text-review-foreground shadow-subtle hover:opacity-90 font-semibold",
        nobid: "bg-nobid text-nobid-foreground shadow-subtle hover:opacity-90 font-semibold",
      },
      size: {
        default: "h-9 px-4 py-2 text-sm",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-11 rounded-xl px-6 text-base font-semibold",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
