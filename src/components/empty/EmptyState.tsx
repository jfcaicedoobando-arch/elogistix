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
  const iconClickable = !!primaryAction;
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      {iconClickable ? (
        <button
          type="button"
          onClick={primaryAction!.onClick}
          aria-label={primaryAction!.label}
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-5 transition hover:bg-primary/20 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
        >
          <Icon className="h-8 w-8" />
        </button>
      ) : (
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-5">
          <Icon className="h-8 w-8" />
        </div>
      )}
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
