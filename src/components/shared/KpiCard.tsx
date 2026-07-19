import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { kpiIconChipClasses, type KpiTone } from "@/lib/ui/kpiTones";
import type { LucideIcon } from "lucide-react";

export type KpiVariant =
  | "default"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "accent"
  | "secondary";

export type KpiIconVariant = "inline" | "chip";

interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: string;
  deltaVariant?: "positive" | "negative" | "neutral";
  icon?: LucideIcon;
  variant?: KpiVariant;
  /** Presentación del icono. `inline` (default) = a la derecha, sin fondo.
   *  `chip` = a la izquierda, con fondo pastel tintado según variant. */
  iconVariant?: KpiIconVariant;
  sublabel?: string;
  /** Tooltip nativo aplicado al valor. Útil cuando el valor viene en notación
   *  compacta (p.ej. "USD 1.2M") y se quiere mostrar el valor completo. */
  valueTooltip?: string;
  onClick?: () => void;
  /** Si se pasa, la card se envuelve en un `<Link to={...}>` (react-router). */
  to?: string;
  /** Renderiza un skeleton en lugar del valor mientras carga. */
  loading?: boolean;
  className?: string;
  /** Contenido opcional que se renderiza debajo del sublabel. */
  children?: React.ReactNode;
}

const variantStyles: Record<KpiVariant, string> = {
  default: "",
  success: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  info: "border-info/30 bg-info/5",
  destructive: "border-destructive/30 bg-destructive/5",
  accent: "",
  secondary: "",
};

const iconStyles: Record<KpiVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
  accent: "text-kpi-accent",
  secondary: "text-muted-foreground",
};

const variantToTone: Record<KpiVariant, KpiTone> = {
  default: "secondary",
  success: "success",
  warning: "warning",
  info: "info",
  destructive: "danger",
  accent: "accent",
  secondary: "secondary",
};

/**
 * Tarjeta KPI canónica: label, valor, delta opcional, icono y variante semántica.
 *
 * Reemplaza las implementaciones locales de KpiCard/KpiTile en dashboards,
 * detalles y catálogos para unificar el design language.
 *
 * v13.302.3: agregado `iconVariant="chip"`, `valueTooltip`, `children` y
 * variants `accent`/`secondary` para absorber el clon de `features/operaciones`.
 */
function valueSize(valueStr: string, iconVariant: KpiIconVariant) {
  // En modo chip el icono va a la izquierda y hay más aire para el número, así
  // que subimos un escalón la tipografía adaptativa.
  if (iconVariant === "chip") {
    if (valueStr.length <= 8) return "text-3xl";
    if (valueStr.length <= 13) return "text-2xl";
    if (valueStr.length <= 18) return "text-xl";
    return "text-lg";
  }
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
  iconVariant: KpiIconVariant;
  valueTooltip?: string;
  children?: React.ReactNode;
}

function KpiBodyInline({
  label, value, valueStr, loading, delta, deltaVariant, sublabel, Icon, variant, valueTooltip, children,
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
              className={cn(valueSize(valueStr, "inline"), "font-semibold tabular-nums truncate")}
              title={valueTooltip ?? valueStr}
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
          {children}
        </div>
        {Icon && <Icon className={cn("h-5 w-5 shrink-0", iconStyles[variant])} />}
      </div>
    </CardContent>
  );
}

function KpiBodyChip({
  label, value, valueStr, loading, delta, deltaVariant, sublabel, Icon, variant, valueTooltip, children,
}: KpiBodyProps) {
  const tone = variantToTone[variant];
  return (
    <CardContent className="p-3 sm:p-5 flex items-center gap-2 sm:gap-4">
      {Icon && (
        <div
          aria-hidden="true"
          className={cn(
            "hidden sm:flex rounded-xl p-2.5 sm:p-3 shrink-0",
            kpiIconChipClasses(tone),
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground truncate" title={label}>{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-24 mt-1" />
        ) : (
          <>
            <p
              className={cn(
                valueSize(valueStr, "chip"),
                "font-bold text-foreground tabular-nums leading-tight truncate",
              )}
              title={valueTooltip ?? valueStr}
            >
              {value}
            </p>
            {delta && (
              <p className={cn("text-xs tabular-nums mt-0.5", deltaClass(deltaVariant))}>{delta}</p>
            )}
            {sublabel && !delta && (
              <p className="text-xs text-muted-foreground truncate mt-0.5" title={sublabel}>
                {sublabel}
              </p>
            )}
          </>
        )}
        {children}
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
  iconVariant = "inline",
  sublabel,
  valueTooltip,
  onClick,
  to,
  loading = false,
  className,
  children,
}: KpiCardProps) {
  const valueStr = String(value ?? "");
  const interactive = Boolean(onClick) && !to;

  const bodyProps: KpiBodyProps = {
    label, value, valueStr, loading, delta, deltaVariant, sublabel,
    Icon, variant, iconVariant, valueTooltip, children,
  };

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
      {iconVariant === "chip" ? <KpiBodyChip {...bodyProps} /> : <KpiBodyInline {...bodyProps} />}
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
