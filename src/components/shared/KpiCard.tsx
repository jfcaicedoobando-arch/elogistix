import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export type KpiVariant = "default" | "success" | "warning" | "info" | "destructive";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaVariant?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  variant?: KpiVariant;
  sublabel?: string;
  onClick?: () => void;
  className?: string;
}

const variantStyles: Record<KpiVariant, string> = {
  default: "",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  info: "border-info/30 bg-info/5",
  destructive: "border-destructive/30 bg-destructive/5",
};

const iconStyles: Record<KpiVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
};

/**
 * Tarjeta KPI canónica: label, valor, delta opcional, icono y variante semántica.
 *
 * Reemplaza las implementaciones locales de KpiCard/KpiTile en dashboards,
 * detalles y catálogos para unificar el design language.
 */
export function KpiCard({
  label,
  value,
  delta,
  deltaVariant = "neutral",
  icon: Icon,
  variant = "default",
  sublabel,
  onClick,
  className,
}: KpiCardProps) {
  return (
    <Card
      className={cn(
        "transition-shadow",
        variantStyles[variant],
        onClick && "cursor-pointer hover:shadow-md",
        className,
      )}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            <p className="text-xl font-semibold tabular-nums truncate">{value}</p>
            {delta && (
              <p
                className={cn(
                  "text-xs tabular-nums",
                  deltaVariant === "positive" && "text-success",
                  deltaVariant === "negative" && "text-destructive",
                  deltaVariant === "neutral" && "text-muted-foreground",
                )}
              >
                {delta}
              </p>
            )}
            {sublabel && !delta && (
              <p className="text-xs text-muted-foreground truncate">{sublabel}</p>
            )}
          </div>
          {Icon && <Icon className={cn("h-5 w-5 shrink-0", iconStyles[variant])} />}
        </div>
      </CardContent>
    </Card>
  );
}
