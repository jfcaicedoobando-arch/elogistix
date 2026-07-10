import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  /** Si se pasa, la card se envuelve en un `<Link to={...}>` (react-router). */
  to?: string;
  /** Renderiza un skeleton en lugar del valor mientras carga. */
  loading?: boolean;
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
function valueSize(valueStr: string) {
  if (valueStr.length <= 8) return "text-2xl";
  if (valueStr.length <= 13) return "text-xl";
  return "text-lg";
}

function deltaClass(deltaVariant: NonNullable<KpiCardProps["deltaVariant"]>) {
  if (deltaVariant === "positive") return "text-success";
  if (deltaVariant === "negative") return "text-destructive";
  return "text-muted-foreground";
}

interface KpiBodyProps {
  label: string;
  value: string | number;
  valueStr: string;
  loading: boolean;
  delta?: string;
  deltaVariant: NonNullable<KpiCardProps["deltaVariant"]>;
  sublabel?: string;
  Icon?: LucideIcon;
  variant: KpiVariant;
}

function KpiBody({
  label,
  value,
  valueStr,
  loading,
  delta,
  deltaVariant,
  sublabel,
  Icon,
  variant,
}: KpiBodyProps) {
  return (
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p
              className={cn(valueSize(valueStr), "font-semibold tabular-nums truncate")}
              title={valueStr}
            >
              {value}
            </p>
          )}
          {delta && (
            <p className={cn("text-xs tabular-nums", deltaClass(deltaVariant))}>{delta}</p>
          )}
          {sublabel && !delta && (
            <p className="text-xs text-muted-foreground truncate">{sublabel}</p>
          )}
        </div>
        {Icon && <Icon className={cn("h-5 w-5 shrink-0", iconStyles[variant])} />}
      </div>
    </CardContent>
  );
}

export function KpiCard({
  label,
  value,
  delta,
  deltaVariant = "neutral",
  icon: Icon,
  variant = "default",
  sublabel,
  onClick,
  to,
  loading = false,
  className,
}: KpiCardProps) {
  const valueStr = String(value ?? "");
  const interactive = Boolean(onClick) && !to;

  const card = (
    <Card
      className={cn(
        "transition-shadow h-full",
        variantStyles[variant],
        (onClick || to) && "cursor-pointer hover:shadow-raised",
        className,
      )}
      onClick={interactive ? onClick : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={(e) => {
        if (interactive && onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <KpiBody
        label={label}
        value={value}
        valueStr={valueStr}
        loading={loading}
        delta={delta}
        deltaVariant={deltaVariant}
        sublabel={sublabel}
        Icon={Icon}
        variant={variant}
      />
    </Card>
  );

  if (to) {
    return (
      <Link
        to={to}
        className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
      >
        {card}
      </Link>
    );
  }
  return card;
}

