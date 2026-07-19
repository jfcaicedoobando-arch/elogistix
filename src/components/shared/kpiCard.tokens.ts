import type { KpiTone } from "@/lib/ui/kpiTones";

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

export const kpiIconStyles: Record<KpiVariant, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  warning: "text-warning",
  info: "text-info",
  destructive: "text-destructive",
  accent: "text-kpi-accent",
  secondary: "text-muted-foreground",
};

export const kpiVariantToTone: Record<KpiVariant, KpiTone> = {
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
