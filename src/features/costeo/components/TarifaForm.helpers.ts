/**
 * Helpers puros y defaults para el formulario de tarifa marítima.
 * Extraídos para mantener `TarifaForm.tsx` ≤200 líneas (Power-of-10).
 */
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import { formatUSD } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import { hoyMx } from "@/lib/date/mx";

/** Re-export para call-sites del TarifaForm. Delega en el canónico `formatUSD`. */
export const usdFormatter = formatUSD;

const todayISO = () => todayLocalISO();

const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return hoyMx(d);
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

export function computeValido(baseValido: boolean, multiple: boolean, rutaIdsCount: number): boolean {
  if (!multiple) return baseValido;
  return baseValido && rutaIdsCount > 0;
}

export function getTituloModal(tituloOverride: string | undefined, esEdicion: boolean): string {
  if (tituloOverride) return tituloOverride;
  return esEdicion ? "Editar tarifa marítima (USD)" : "Nueva tarifa marítima (USD)";
}

const ETIQUETAS: Record<string, string> = {
  agente_id: "Agente",
  naviera_id: "Naviera",
  ruta_id: "Ruta",
  tipo_contenedor_id: "Tipo de contenedor",
  flete_base: "Flete base",
  vigente_desde: "Vigencia desde",
  vigente_hasta: "Vigencia hasta",
};

export function calcularErrores(form: TarifaInput, rutaIdsCount: number, multiple: boolean): Record<string, boolean> {
  return {
    agente_id: !form.agente_id,
    naviera_id: !form.naviera_id,
    ruta_id: multiple ? rutaIdsCount === 0 : !form.ruta_id,
    tipo_contenedor_id: !form.tipo_contenedor_id,
    flete_base: !(Number(form.flete_base) > 0),
    vigente_desde: !form.vigente_desde,
    vigente_hasta: !form.vigente_hasta,
  };
}

export function camposFaltantes(errores: Record<string, boolean>): string[] {
  return Object.entries(errores).filter(([, v]) => v).map(([k]) => ETIQUETAS[k] ?? k);
}

export function computeGuardarLabel({ pendiente, esEdicion, rutasCount }: { pendiente: boolean; esEdicion: boolean; rutasCount: number }): string {
  if (pendiente) return "Guardando…";
  if (esEdicion) return "Guardar cambios";
  if (rutasCount > 1) return `Guardar ${rutasCount} tarifas`;
  return "Guardar tarifa";
}

/**
 * ¿Hay captura sin guardar en el formulario de tarifa? Compara el estado actual
 * contra la fotografía tomada al abrir el modal (incluye las rutas elegidas en
 * el alta en lote). Alimenta el `isDirty` de `FormDialogShell` para no perder
 * lo capturado al cerrar con X / Escape / clic fuera / Cancelar.
 */
export function esTarifaSucia(
  form: TarifaInput,
  baseline: TarifaInput,
  rutaIds: string[],
  rutaIdsBase: string[],
): boolean {
  const mismasRutas =
    JSON.stringify([...rutaIds].sort()) === JSON.stringify([...rutaIdsBase].sort());
  return !mismasRutas || JSON.stringify(form) !== JSON.stringify(baseline);
}
