/**
 * Realineo de `fecha_emision` al día del timbre.
 *
 * EERR-FISCAL (v13.823.247) bloqueaba el timbrado cuando la factura traía la
 * fecha de otro día, pero la UI no ofrece ningún campo para corregirla: el
 * borrador quedaba atorado. FacturAPI/SAT certifican el CFDI con la fecha del
 * timbre, así que la fila se realinea a hoy (zona fiscal de México) justo
 * antes de emitir, en vez de rechazar la operación.
 *
 * El tipo de cambio NO se calcula aquí: el trigger `_factura_tc_dof_obligatorio`
 * lo resuelve del DOF vigente a la nueva `fecha_emision`, y
 * `facturas_set_fecha_vencimiento` recalcula el vencimiento con los días de
 * crédito. Si el DOF no tiene una publicación utilizable, el trigger levanta
 * `LC_FACTURA_SIN_TC_DOF` / `LC_FACTURA_TC_DOF_OBSOLETO` y aquí se traduce a un
 * 422 accionable — antes del claim y antes de cualquier llamada al PAC.
 */
import { type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { jsonResponse } from "../_shared/response.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { FACTURA_COLUMNS, type FacturaRow, type UserIdentity } from "./types.ts";

/** `YYYY-MM-DD` de hoy en hora de México (zona fiscal del CFDI). */
export function hoyMx(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** ¿La factura quedó fechada en otro día que el del timbre? */
export function fechaDesfasada(factura: FacturaRow, now: Date = new Date()): boolean {
  const fecha = (factura.fecha_emision ?? "").slice(0, 10);
  return Boolean(fecha) && fecha !== hoyMx(now);
}

const MARCAS_TC_DOF = ["LC_FACTURA_SIN_TC_DOF", "LC_FACTURA_TC_DOF_OBSOLETO"];

export function esErrorTcDof(mensaje: string | null | undefined): boolean {
  const texto = mensaje ?? "";
  return MARCAS_TC_DOF.some((marca) => texto.includes(marca));
}

export function respuestaTcDof(mensaje: string): Response {
  return jsonResponse({
    error: "tc_dof_no_disponible",
    message:
      "No se pudo actualizar la factura a la fecha de hoy porque falta el tipo de cambio del DOF vigente. " +
      "Sincroniza el DOF (o captúralo) y vuelve a intentar el timbrado; la factura quedó sin timbrar.",
    detail: mensaje,
  }, 422);
}

/**
 * Deja la factura con la fecha de hoy y devuelve la fila releída. Si ya está en
 * hoy, regresa la fila tal cual sin escribir nada. Nunca toca una factura ya
 * timbrada (`facturapi_id` no nulo) ni una en papelera: esos casos los filtra
 * el `update` y se responden con 409.
 */
export async function realinearFechaEmision(
  supabase: SupabaseClient,
  factura: FacturaRow,
  estadosTimbrables: readonly string[],
  user: UserIdentity,
  now: Date = new Date(),
): Promise<FacturaRow | Response> {
  if (!fechaDesfasada(factura, now)) return factura;
  const fechaAnterior = (factura.fecha_emision ?? "").slice(0, 10);
  const hoy = hoyMx(now);

  const { data, error } = await supabase
    .from("facturas")
    .update({ fecha_emision: hoy })
    .eq("id", factura.id)
    .is("deleted_at", null)
    .is("facturapi_id", null)
    .in("estado", estadosTimbrables)
    .select(FACTURA_COLUMNS)
    .maybeSingle();

  if (error) {
    if (esErrorTcDof(error.message)) return respuestaTcDof(error.message);
    console.error("fecha_emision_realineo_failed", { facturaId: factura.id, code: error.code });
    return jsonResponse({
      error: "fecha_emision_no_actualizada",
      message: "No se pudo poner la fecha de hoy en la factura. Intenta de nuevo; no se timbró nada.",
    }, 500);
  }
  if (!data) {
    return jsonResponse({
      error: "estado_no_timbrable",
      message: "La factura dejó de ser timbrable (cambió de estado, se timbró o se movió a la papelera).",
    }, 409);
  }

  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id,
    usuarioId: user.id,
    usuarioEmail: user.email,
    modulo: "facturacion",
    accion: "realinear_fecha_emision_timbrado",
    entidadId: factura.id,
    entidadNombre: factura.numero ?? "",
    detalles: { fecha_anterior: fechaAnterior, fecha_nueva: hoy, moneda: factura.moneda ?? "MXN" },
  });

  return data as unknown as FacturaRow;
}
