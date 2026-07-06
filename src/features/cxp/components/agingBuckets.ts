/**
 * Cubetas de aging para CxP. Vive aparte del componente `AgingDrillDownDialog`
 * para respetar react-refresh/only-export-components.
 */
export type CubetaAging = "vigente" | "d_1_30" | "d_31_60" | "d_61_90" | "mas_90";

export function bucketDeDias(dias: number): CubetaAging {
  if (dias <= 0) return "vigente";
  if (dias <= 30) return "d_1_30";
  if (dias <= 60) return "d_31_60";
  if (dias <= 90) return "d_61_90";
  return "mas_90";
}

export const BUCKET_LABELS: Record<CubetaAging, string> = {
  vigente: "Vigente",
  d_1_30: "1-30 d",
  d_31_60: "31-60 d",
  d_61_90: "61-90 d",
  mas_90: ">90 d",
};

export const BUCKET_TONES: Record<CubetaAging, string> = {
  vigente: "bg-muted text-muted-foreground",
  d_1_30: "bg-warning/10 text-warning",
  d_31_60: "bg-warning/20 text-warning",
  d_61_90: "bg-destructive/10 text-destructive",
  mas_90: "bg-destructive/20 text-destructive",
};
