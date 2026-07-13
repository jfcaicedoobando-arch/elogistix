/**
 * Helpers puros de `GuardarPlantillaDialog`. Extraídos para cumplir
 * `react-refresh/only-export-components` sin sacrificar Power of 10.
 */
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";

/**
 * Campos regenerados en cada aplicación de plantilla — no deben persistirse.
 */
const CAMPOS_TRANSITORIOS = [
  "id",
  "folio",
  "fecha_cotizacion",
  "fecha_vencimiento",
  "tarifa_id",
  "tarifa_snapshot",
] as const;

export function limpiarValues(
  values: Partial<CotizacionFormValues>,
): Partial<CotizacionFormValues> {
  const clon: Partial<CotizacionFormValues> & Record<string, unknown> = { ...values };
  for (const campo of CAMPOS_TRANSITORIOS) {
    delete clon[campo as keyof typeof clon];
  }
  return clon;
}
