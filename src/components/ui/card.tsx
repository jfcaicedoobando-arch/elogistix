/**
 * Card primitives — wrappers semánticos sobre `<div>` que aplican los tokens
 * de superficie del design system (`bg-card`, `text-card-foreground`,
 * `shadow-card`, `rounded-lg`, `border`).
 *
 * ## Reglas (v13.140.x)
 *
 * 1. **Nunca** sobre-escribas `shadow-*`, `border-*` ni `rounded-*` en
 *    instancias de `<Card>`. Si necesitas elevación adicional usa
 *    `shadow-raised` (existe como token). Cualquier otro override rompe
 *    cohesión visual y será marcado en auditoría.
 *
 * 2. **Densidad de `<CardContent>`**: en lugar de pasar
 *    `className="p-3"` o `className="p-4"` ad-hoc, usa la prop `density`:
 *    - `density="default"` → `p-6 pt-0` (el de siempre, recomendado).
 *    - `density="compact"` → `p-4` (tarjetas medianas tipo CxP toolbar).
 *    - `density="tight"`   → `p-3` (KPI compactos, tesorería/comisiones).
 *    - `density="flush"`   → `p-0` (cuando el hijo es una tabla full-bleed
 *      que ya gestiona su propio padding — patrón aprobado en facturación,
 *      embarques, cxp y conciliación).
 *
 *    `pt-0` se omite en compact/tight/flush porque allí el header suele
 *    estar ausente. Si combinas `<CardHeader>` + `<CardContent
 *    density="compact">` y necesitas `pt-0`, pásalo explícito.
 */
import * as React from "react";

import { cn } from "@/lib/utils";

const Card = ({ ref, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
  <div
    ref={ref}
    className={cn("rounded-lg border bg-card text-card-foreground shadow-card transition-shadow", className)}
    {...props}
  />
);
Card.displayName = "Card";

const CardHeader = ({ ref, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6 pb-3", className)} {...props} />
  );
CardHeader.displayName = "CardHeader";

const CardTitle = ({ ref, className, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { ref?: React.Ref<HTMLParagraphElement> }) => (
    <h3 ref={ref} className={cn("text-card-title tracking-tight", className)} {...props} />
  );
CardTitle.displayName = "CardTitle";

const CardDescription = ({ ref, className, ...props }: React.HTMLAttributes<HTMLParagraphElement> & { ref?: React.Ref<HTMLParagraphElement> }) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
CardDescription.displayName = "CardDescription";

type CardContentDensity = "default" | "compact" | "tight" | "flush";

interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ver JSDoc del archivo. Reemplaza overrides ad-hoc de `p-3/p-4/p-0`. */
  density?: CardContentDensity;
}

const DENSITY_CLASS: Record<CardContentDensity, string> = {
  default: "p-6 pt-0",
  compact: "p-4",
  tight: "p-3",
  flush: "p-0",
};

const CardContent = ({ ref, className, density = "default", ...props }: CardContentProps & { ref?: React.Ref<HTMLDivElement> }) => (
    <div ref={ref} className={cn(DENSITY_CLASS[density], className)} {...props} />
  );
CardContent.displayName = "CardContent";

const CardFooter = ({ ref, className, ...props }: React.HTMLAttributes<HTMLDivElement> & { ref?: React.Ref<HTMLDivElement> }) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  );
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
export type { CardContentDensity, CardContentProps };
