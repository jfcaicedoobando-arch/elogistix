import { CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
  children?: React.ReactNode;
}

export function KpiBodyInline({
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
              className={cn(kpiValueSize(valueStr, "inline"), "font-semibold tabular-nums truncate")}
              title={valueTooltip ?? valueStr}
            >
              {value}
            </p>
          )}
          {delta && <p className={cn("text-xs tabular-nums", kpiDeltaClass(deltaVariant))}>{delta}</p>}
          {sublabel && !delta && (
            <p className="text-xs text-muted-foreground truncate">{sublabel}</p>
          )}
          {children}
        </div>
        {Icon && <Icon className={cn("h-5 w-5 shrink-0", kpiIconStyles[variant])} />}
      </div>
    </CardContent>
  );
}

export function KpiBodyChip({
  label, value, valueStr, loading, delta, deltaVariant, sublabel, Icon, variant, valueTooltip, children,
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
        <p className="text-xs text-muted-foreground truncate" title={label}>{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-24 mt-1" />
        ) : (
          <>
            <p
              className={cn(
                kpiValueSize(valueStr, "chip"),
                "font-bold text-foreground tabular-nums leading-tight truncate",
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
