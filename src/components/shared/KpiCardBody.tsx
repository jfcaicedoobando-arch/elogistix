import { CardContent } from "@/components/ui/card";
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
export type KpiDeltaVariant = "positive" | "negative" | "neutral";

export const kpiVariantStyles: Record<KpiVariant, string> = {
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

/** Escalones de tipografía adaptativa según longitud e iconVariant. */
export function kpiValueSize(valueStr: string, iconVariant: KpiIconVariant) {
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

export function kpiDeltaClass(deltaVariant: KpiDeltaVariant) {
  if (deltaVariant === "positive") return "text-success";
  if (deltaVariant === "negative") return "text-destructive";
  return "text-muted-foreground";
}

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
        {Icon && <Icon className={cn("h-5 w-5 shrink-0", iconStyles[variant])} />}
      </div>
    </CardContent>
  );
}

export function KpiBodyChip({
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
