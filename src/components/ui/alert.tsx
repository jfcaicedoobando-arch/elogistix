import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
  {
    variants: {
      variant: {
        default: "bg-background text-foreground",
        /* Ola 3 · O3.8 — callout canónico: borde y fondo suave tintados +
           icono al tono; es la única forma permitida de banner de estado
           (ver guardia no-raw-callout). */
        info: "border-info/40 bg-info/5 text-foreground [&>svg]:text-info",
        destructive: "border-destructive/40 bg-destructive/5 text-foreground [&>svg]:text-destructive",
        warning: "border-warning/40 bg-warning/5 text-foreground [&>svg]:text-warning",
        success: "border-success/40 bg-success/5 text-foreground [&>svg]:text-success",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const Alert = ({ ref, className, variant, ...props }: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof alertVariants> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
);
Alert.displayName = "Alert";

const AlertTitle = ({ ref, className, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { ref?: React.Ref<HTMLParagraphElement> }) => (
    <h5 ref={ref} className={cn("mb-1 font-medium leading-none tracking-tight", className)} {...props} />
  );
AlertTitle.displayName = "AlertTitle";

const AlertDescription = ({ ref, className, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) => (
    <div ref={ref} className={cn("text-body [&_p]:leading-relaxed", className)} {...props} />
  );
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
