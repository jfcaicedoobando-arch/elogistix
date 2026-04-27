import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary";
}

export interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  primaryAction?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  className?: string;
}

/**
 * Estado vacío / no encontrado reutilizable, alineado al estilo visual de la app.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-5">
        <Icon className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">{title}</h2>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md mb-6">{description}</p>
      )}
      {(primaryAction || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {primaryAction && (
            <Button variant={primaryAction.variant ?? "default"} onClick={primaryAction.onClick}>
              {primaryAction.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant={secondaryAction.variant ?? "outline"} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
