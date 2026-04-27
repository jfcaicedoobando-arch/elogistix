import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Sección estándar para wizards (Cotización / Embarque).
 * Garantiza tipografía y espaciado consistentes en todos los pasos.
 *
 * Uso:
 *   <WizardSection title="Datos Generales">
 *     <FormField ...> ... </FormField>
 *   </WizardSection>
 */
interface WizardSectionProps {
  title: string;
  description?: string;
  /** Acciones opcionales en el header (botones, badges) */
  actions?: ReactNode;
  /** Aplica grid responsive 1/2/3 columnas con gap consistente */
  columns?: 1 | 2 | 3;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}

export function WizardSection({
  title,
  description,
  actions,
  columns,
  className,
  contentClassName,
  children,
}: WizardSectionProps) {
  const gridClass =
    columns === 2 ? "grid grid-cols-1 md:grid-cols-2 gap-4"
    : columns === 3 ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    : "space-y-4";

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </CardHeader>
      <CardContent className={cn(gridClass, contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}
