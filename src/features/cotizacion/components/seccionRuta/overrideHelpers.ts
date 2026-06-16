import type { UseFormReturn } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";

export type Ctx = UseFormReturn<CotizacionFormValues>;

export const OPTS = { shouldValidate: true, shouldDirty: true } as const;

export interface TarifaCtx {
  tieneTarifa: boolean;
  hasTransito: boolean;
  hasDiasLibres: boolean;
  hasCartaGarantia: boolean;
}

export function marcarOverride(ctx: Ctx, campo: string) {
  const actual = ctx.getValues("tarifaOverride") ?? {};
  ctx.setValue("tarifaOverride", { ...actual, [campo]: true }, OPTS);
}
