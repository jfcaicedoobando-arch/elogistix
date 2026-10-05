import { ROUTES } from "@/constants/routes";

/** Los enlaces de consulta abren el comparativo, conservando su periodo. */
export function presupuestoVsRealHref(periodo?: string): string {
  const params = new URLSearchParams({ tab: "vs-real" });
  if (periodo) params.set("periodo_vs_real", periodo);
  return `${ROUTES.PROFIT_PRESUPUESTO}?${params}`;
}
