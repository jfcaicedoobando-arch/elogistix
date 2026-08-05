import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { kpiIconChipClasses } from "@/lib/ui/kpiTones";
import type { LucideIcon } from "lucide-react";
import {
  kpiDeltaClass,
  kpiIconStyles,
  kpiValueSize,
  kpiVariantToTone,
  type KpiDeltaVariant,
  type KpiIconVariant,
  type KpiVariant,
} from "./kpiCard.tokens";

export interface KpiBodyProps {
  label: string;
  value: string | number;
  valueStr: string;
  loading: boolean;
  delta?: string;
  deltaVariant: KpiDeltaVariant;
  sublabel?: string;
  Icon?: LucideIcon;
  variant: KpiVariant;
  iconVariant: KpiIconVariant;
  valueTooltip?: string;
  /** Ayuda contextual: muestra un icono de info con tooltip junto al label. */
  hint?: string;
  /** Afordancia de navegación (flecha) cuando la card es un enlace. */
  showArrow?: boolean;
  children?: React.ReactNode;
}

/** Fila de etiqueta canónica: label truncado + hint opcional. */
function KpiLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <p className="text-xs text-muted-foreground truncate" title={label}>{label}</p>
      {hint && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="button"
              tabIndex={0}
              aria-label={`Información: ${label}`}
              className="inline-flex shrink-0 rounded-sm text-muted-foreground/70 hover:text-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <Info className="h-3 w-3" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[260px] text-xs">{hint}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export function KpiBodyInline({
  label, value, valueStr, loading, delta, deltaVariant, sublabel, Icon, variant,
  valueTooltip, hint, showArrow, children,
}: KpiBodyProps) {
  return (
    <CardContent className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <KpiLabel label={label} hint={hint} />
          {loading ? (
            <Skeleton className="h-7 w-20" />
          ) : (
            <p
              className={cn(kpiValueSize(valueStr, "inline"), "font-semibold tabular-nums truncate")}
              title={valueTooltip ?? valueStr}
            >
              {value}
            </p>
          )}
          {delta && <p className={cn("text-xs tabular-nums", kpiDeltaClass(deltaVariant))}>{delta}</p>}
          {sublabel && !delta && (
            <p className="text-xs text-muted-foreground truncate" title={sublabel}>{sublabel}</p>
          )}
          {children}
        </div>
        {showArrow ? (
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-colors group-hover:text-primary" />
        ) : Icon ? (
          <Icon className={cn("h-5 w-5 shrink-0", kpiIconStyles[variant])} />
        ) : null}
      </div>
    </CardContent>
  );
}

export function KpiBodyChip({
  label, value, valueStr, loading, delta, deltaVariant, sublabel, Icon, variant,
  valueTooltip, hint, children,
}: KpiBodyProps) {
  const tone = kpiVariantToTone[variant];
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
        <KpiLabel label={label} hint={hint} />
        {loading ? (
          <Skeleton className="h-8 w-24 mt-1" />
        ) : (
          <>
            <p
              className={cn(
                kpiValueSize(valueStr, "chip"),
                "font-semibold text-foreground tabular-nums leading-tight truncate",
              )}
              title={valueTooltip ?? valueStr}
            >
              {value}
            </p>
            {delta && (
              <p className={cn("text-xs tabular-nums mt-0.5", kpiDeltaClass(deltaVariant))}>{delta}</p>
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
