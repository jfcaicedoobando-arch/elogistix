/**
 * Helpers puros y defaults para el formulario de tarifa marítima.
 * Extraídos para mantener `TarifaForm.tsx` ≤200 líneas (Power-of-10).
 */
import type { TarifaInput } from "@/features/costeo/services/tarifas";

export const usdFormatter = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" }).format(n);

const todayISO = () => new Date().toISOString().slice(0, 10);

const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const TARIFA_DEFAULTS: TarifaInput = {
  agente_id: "", naviera_id: "", ruta_id: "", tipo_contenedor_id: "",
  flete_base: 0, dias_libres_demoras: 7,
  vigente_desde: "", vigente_hasta: "",
  transit_time_dias: null, notas: "", recargos: [],
};

export function buildInitialForm(initial?: Partial<TarifaInput>): TarifaInput {
  const base: TarifaInput = {
    ...TARIFA_DEFAULTS,
    vigente_desde: todayISO(),
    vigente_hasta: plusDays(30),
  };
  return { ...base, ...(initial ?? {}) };
}

export function calcularTotal(form: TarifaInput): number {
  const rec = form.recargos
    .filter((r) => r.incluido_en_total !== false)
    .reduce((acc, r) => acc + (Number(r.monto) || 0), 0);
  return (Number(form.flete_base) || 0) + rec;
}

export function esFormValido(form: TarifaInput, opts?: { skipRutaId?: boolean }): boolean {
  if (!form.agente_id || !form.naviera_id || !form.tipo_contenedor_id) return false;
  if (!opts?.skipRutaId && !form.ruta_id) return false;
  if (form.flete_base <= 0) return false;
  return form.vigente_desde <= form.vigente_hasta;
}
