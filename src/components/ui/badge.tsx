import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success: "border-transparent bg-success/15 text-success-foreground/90 [color:hsl(var(--success))] hover:bg-success/20",
        warning: "border-transparent bg-warning/15 [color:hsl(var(--warning))] hover:bg-warning/20",
        info: "border-transparent bg-info/15 [color:hsl(var(--info))] hover:bg-info/20",
        neutral: "border-transparent bg-muted text-muted-foreground hover:bg-muted/80",
      },
      // Ola 7 · Lote A — reemplaza los ~12 sitios con `text-[10px] h-4 px-1.5` inline.
      size: {
        default: "px-2 py-0.5 text-xs",
        xs: "px-1.5 py-0 text-2xs h-4",
        sm: "px-2 py-0 text-2xs h-5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

const Badge = ({ ref, className, variant, size, ...props }: BadgeProps & { ref?: React.Ref<HTMLDivElement> }) => (
    <div ref={ref} className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
Badge.displayName = "Badge";

export { Badge, badgeVariants };
