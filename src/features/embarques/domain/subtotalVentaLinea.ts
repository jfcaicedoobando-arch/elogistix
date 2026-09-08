/**
 * R219-UI-01 — Subtotal de una fila de venta del wizard de embarques.
 *
 * La vista previa del Paso 4 mostraba sólo el precio unitario e ignoraba la
 * cantidad, así que el total y la utilidad no coincidían con lo que la
 * persistencia guarda (`subtotalLinea(cantidad, precioUnitario)` en
 * `embarqueToDbConceptos.ts`).
 *
 * Contrato de cantidad (el MISMO que valida el wizard en
 * `embarqueWizardCostos.ts`): una venta sólo es válida con `cantidad >= 1`.
 * Por eso:
 *  - `null`/`undefined` (cantidad AUSENTE, filas legacy replicadas de
 *    cotización que no traían la columna) se lee como 1;
 *  - `0`, negativos y `NaN` son INVÁLIDOS: no se inventa una venta de 1,
 *    la fila aporta 0 a la vista previa y el validador la bloquea igual.
 */
import { subtotalLinea } from "@/lib/financial/financialUtils";

/**
 * @returns la cantidad a usar en la vista previa, o `null` si es inválida.
 */
export function cantidadVentaValida(
  cantidad: number | null | undefined,
): number | null {
  if (cantidad == null) return 1; // ausente ≠ 0: dato legacy sin columna.
  const n = Number(cantidad);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function subtotalVentaLinea(
  cantidad: number | null | undefined,
  precioUnitario: number,
): number {
  const c = cantidadVentaValida(cantidad);
  if (c == null) return 0;
  const pu = Number.isFinite(precioUnitario) ? precioUnitario : 0;
  return subtotalLinea(c, pu);
}
