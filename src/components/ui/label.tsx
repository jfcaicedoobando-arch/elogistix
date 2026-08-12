import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * UX-08: el tamaño del label es una variante del design system, no un
 * `className="text-xs"` suelto. Usa `size="sm"` para formularios densos.
 */
const labelVariants = cva(
  "font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
  {
    variants: {
      size: {
        default: "text-sm",
        sm: "text-xs",
      },
    },
    defaultVariants: { size: "default" },
  },
);

const Label = ({ ref, className, size, ...props }: React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root> & VariantProps<typeof labelVariants> & { ref?: React.Ref<React.ElementRef<typeof LabelPrimitive.Root>> }) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants({ size }), className)} {...props} />
);
Label.displayName = LabelPrimitive.Root.displayName;

export { Label, labelVariants };
