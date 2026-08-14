/**
 * v13.624.0 — Política de autorización del cliente ("cliente de casa").
 *
 * Funciones puras, sin React ni Supabase: los flags viven en
 * `clientes.requiere_autorizacion_cotizacion` / `..._proforma`, con default
 * `true` en base de datos. Cuando el dato falta (columna aún no seleccionada o
 * cliente inexistente) se asume `true`: exigir autorización es el
 * comportamiento seguro.
 */

export type FlagAutorizacion =
  | "requiere_autorizacion_cotizacion"
  | "requiere_autorizacion_proforma";

/** Lee un flag de autorización de forma tolerante (default: `true`). */
export function leerFlagAutorizacion(
  fuente: unknown,
  flag: FlagAutorizacion,
): boolean {
  if (!fuente || typeof fuente !== "object") return true;
  const valor = (fuente as Record<string, unknown>)[flag];
  return typeof valor === "boolean" ? valor : true;
}

/** ¿El cliente es "de casa" (no requiere autorizar ni cotizaciones ni proformas)? */
export function esClienteDeCasa(fuente: unknown): boolean {
  return (
    !leerFlagAutorizacion(fuente, "requiere_autorizacion_cotizacion") &&
    !leerFlagAutorizacion(fuente, "requiere_autorizacion_proforma")
  );
}
