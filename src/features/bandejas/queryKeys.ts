// 13.275.0 — Factory de query keys para bandejas.
// El prefijo raíz `"bandeja"` se preserva porque hay invalidaciones externas
// en `src/features/cxp/hooks/useAprobarFacturasLote.ts` y `useCerrarFacturaSinPago.ts`
// que llaman `invalidateQueries({ queryKey: ["bandeja"] })` — cambiar el prefijo
// rompería esas invalidaciones silenciosamente.
export const bandejas = {
  all: ["bandeja"] as const,
  cxpPorCapturar: ["bandeja", "cxp-por-capturar"] as const,
  cxpPorPagar: ["bandeja", "cxp-por-pagar"] as const,
  carteraPendiente: ["bandeja", "cartera-pendiente"] as const,
} as const;
