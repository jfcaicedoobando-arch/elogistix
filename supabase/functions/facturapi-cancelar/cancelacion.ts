/**
 * Sub-helpers de `facturapi-cancelar` con I/O acotado a Supabase.
 * Extraídos para bajar `max-lines-per-function` del handler.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/** Traduce el mensaje crudo de FacturApi en un texto accionable + flag transient. */
export function enrichCancelacionErrorMessage(rawMessage: string): {
  message: string;
  transient: boolean;
} {
  const esNoCancelable = /no cancelable|marcada como no|no puede.*cancel|facturas relacionadas/i.test(rawMessage);
  const esServicioSatCaido = /cancelacionsat no est|servicio.*sat.*no.*disp|sat.*no.*disponible/i.test(rawMessage);
  if (esServicioSatCaido) {
    return {
      message: "El SAT no está respondiendo en este momento (servicio de cancelación caído del lado del SAT). No es un problema de tu factura ni de tus datos. Espera unos minutos y reintenta.",
      transient: true,
    };
  }
  if (esNoCancelable) {
    return {
      message: `${rawMessage}\n\nEl SAT rechazó la cancelación. Causas comunes:\n• El receptor debe ACEPTAR la cancelación en su Buzón Tributario (CFDIs > $1,000 MXN).\n• Existen complementos de pago (REP) o notas de crédito vinculados: cancélalos primero.\n• El SAT aún no propaga la sustitución: reintenta en 30–60 minutos.`,
      transient: false,
    };
  }
  return { message: rawMessage, transient: false };
}

/** Resuelve UUID + facturapi_id de la sustituta a partir de su factura_id local. */
export async function resolveSustitutaSnapshot(
  supabase: SupabaseClient,
  sustituidaPorFacturaId: string,
): Promise<
  | { ok: true; uuid: string; facturapiId: string }
  | { ok: false }
> {
  const { data } = await supabase
    .from("facturas")
    .select("id, uuid_fiscal, facturapi_id")
    .eq("id", sustituidaPorFacturaId)
    .maybeSingle();
  if (!data?.uuid_fiscal || !data.facturapi_id) return { ok: false };
  return { ok: true, uuid: data.uuid_fiscal as string, facturapiId: data.facturapi_id as string };
}

/** Revierte los enlaces `factura_id` de las proformas asociadas a la factura cancelada. */
export async function revertirProformasCancelacion(
  supabase: SupabaseClient,
  facturaId: string,
): Promise<Array<{ id: string; estado: string }>> {
  const revertidas: Array<{ id: string; estado: string }> = [];
  const { data: proformasLigadas } = await supabase
    .from("proformas")
    .select("id, factura_id, factura_secundaria_id")
    .or(`factura_id.eq.${facturaId},factura_secundaria_id.eq.${facturaId}`);
  for (const pf of proformasLigadas ?? []) {
    const nuevoFacturaId = pf.factura_id === facturaId ? null : pf.factura_id;
    const nuevoFacturaSecId = pf.factura_secundaria_id === facturaId ? null : pf.factura_secundaria_id;
    const ambosNulos = !nuevoFacturaId && !nuevoFacturaSecId;
    const patch: Record<string, unknown> = {
      factura_id: nuevoFacturaId,
      factura_secundaria_id: nuevoFacturaSecId,
    };
    if (ambosNulos) {
      patch.estado_proforma = "pendiente";
      patch.fecha_facturacion = null;
      patch.folio_factura_externa = null;
    }
    const { error: upErr } = await supabase.from("proformas").update(patch).eq("id", pf.id);
    if (!upErr) revertidas.push({ id: pf.id, estado: ambosNulos ? "pendiente" : "facturada" });
  }
  return revertidas;
}
