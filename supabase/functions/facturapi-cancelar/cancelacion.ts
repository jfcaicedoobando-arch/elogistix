/**
 * Sub-helpers de `facturapi-cancelar` con I/O acotado a Supabase.
 * Extraídos para bajar `max-lines-per-function` del handler.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { describeFacturapiError, type FacturapiErrorDetail } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";

type FapiInvoicesLike = { invoices: { retrieve: (id: string) => Promise<unknown> } };

/**
 * Corre el pre-flight de motivo 01: consulta UUID original en BD y verifica
 * `related_documents` remoto. Si algo falla, devuelve la Response directamente
 * (422) o `null` para continuar el flujo normal.
 */
export async function runPreflightSustitucion(params: {
  supabase: SupabaseClient;
  facturapi: FapiInvoicesLike;
  facturaId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
  motivo: string;
  sustituyeFacturapiId: string;
  sustituidaPorFacturaId: string | null;
}): Promise<Response | null> {
  const { data: originalRow } = await params.supabase
    .from("facturas")
    .select("uuid_fiscal")
    .eq("id", params.facturaId)
    .maybeSingle();
  const uuidOriginal = (originalRow?.uuid_fiscal ?? "") as string;
  if (!uuidOriginal) return null;

  const check = await verificarRelacionSustitutaSAT(
    params.facturapi,
    params.sustituyeFacturapiId,
    uuidOriginal,
  );
  if (check.ok) return null;

  await registrarBitacoraEdge(params.supabase, {
    organizationId: params.organizationId,
    usuarioId: params.usuarioId,
    usuarioEmail: params.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_cancelar_preflight_fallo",
    entidadId: params.facturaId,
    detalles: {
      motivo: params.motivo,
      sustituida_por_factura_id: params.sustituidaPorFacturaId,
      uuid_original: uuidOriginal,
      remote_related_documents: check.remoteRelated ?? null,
    },
  });
  return jsonResponse({
    error: "sustituta_sin_relacion_04",
    message: check.message,
    remote_related_documents: check.remoteRelated ?? null,
    transient: false,
  }, 422);
}

/**
 * Convierte una excepción del SDK en una Response 502 con bitácora ya
 * escrita. Centraliza el patrón para acortar el handler.
 */
export async function handleCancelFailure(params: {
  err: unknown;
  supabase: SupabaseClient;
  facturaId: string;
  organizationId: string;
  usuarioId: string;
  usuarioEmail?: string;
}): Promise<Response> {
  const { status, detail } = describeFacturapiError(params.err);
  await registrarBitacoraEdge(params.supabase, {
    organizationId: params.organizationId,
    usuarioId: params.usuarioId,
    usuarioEmail: params.usuarioEmail,
    modulo: "facturacion",
    accion: "facturapi_cancelar_failed",
    entidadId: params.facturaId,
    detalles: {
      status,
      response: detail,
      facturapi_code: detail.code ?? null,
      facturapi_path: detail.path ?? null,
      facturapi_errors: detail.errors ?? null,
      facturapi_log_id: detail.logId ?? null,
    },
  });
  return jsonResponse({
    error: "facturapi_error",
    status,
    detail,
    ...buildCancelacionErrorPayload(detail, status),
  }, 502);
}

function buildCancelacionErrorPayload(detail: FacturapiErrorDetail, status: number): {
  message: string;
  transient: boolean;
} {
  const codePrefix = detail.code ? `[${detail.code}] ` : "";
  const rawMessage = `${codePrefix}${detail.message ?? `FacturApi respondió ${status}`}`;
  return enrichCancelacionErrorMessage(rawMessage);
}


/** Traduce el mensaje crudo de FacturApi en un texto accionable + flag transient. */
export function enrichCancelacionErrorMessage(rawMessage: string): {
  message: string;
  transient: boolean;
} {
  const esNoCancelable = /no cancelable|marcada como no|no puede.*cancel|facturas relacionadas/i.test(rawMessage);
  const esServicioSatCaido = /cancelacionsat no est|servicio.*sat.*no.*disp|sat.*no.*disponible/i.test(rawMessage);
  const esMotivoInvalido = /motiv[oe].*(no.*(v[aá]lido|especificad))|no se especific[oó].*motiv/i.test(rawMessage);
  if (esServicioSatCaido) {
    return {
      message: "El SAT no está respondiendo en este momento (servicio de cancelación caído del lado del SAT). No es un problema de tu factura ni de tus datos. Espera unos minutos y reintenta.",
      transient: true,
    };
  }
  if (esMotivoInvalido) {
    return {
      message: `${rawMessage}\n\nFacturAPI rechazó el motivo. Suele ocurrir cuando:\n• La factura sustituta no fue timbrada con relación SAT 04 apuntando al UUID original.\n• La factura original tiene notas de crédito o complementos de pago (REP) ligados.\n• El SAT aún no propaga la sustitución (reintenta en 30–60 minutos).\n\nUsa "Consultar en FacturAPI" para comparar el estado remoto contra el local.`,
      transient: false,
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

/**
 * Pre-flight para motivo 01: verifica que la sustituta remota tenga el
 * bloque `related_documents` con `relationship: "04"` apuntando al UUID
 * de la factura que se va a cancelar. Si no, la cancelación va a fallar
 * en el SAT con un mensaje críptico; mejor detectarlo antes.
 */
export async function verificarRelacionSustitutaSAT(
  facturapi: { invoices: { retrieve: (id: string) => Promise<unknown> } },
  sustitutaFacturapiId: string,
  uuidOriginal: string,
): Promise<
  | { ok: true }
  | { ok: false; message: string; remoteRelated?: unknown }
> {
  try {
    const remota = (await facturapi.invoices.retrieve(sustitutaFacturapiId)) as {
      related_documents?: Array<{
        relationship?: string;
        uuid?: string;
        // Al consultar, FacturAPI agrupa: documents puede ser string[] o {uuid}[].
        documents?: Array<string | { uuid?: string }>;
      }>;
    };
    const bloques = Array.isArray(remota?.related_documents) ? remota.related_documents : [];
    const uuidUp = uuidOriginal.toUpperCase();
    const referencia = bloques.some((b) => {
      if (b?.relationship !== "04") return false;
      // Shape 1: uuid a nivel del bloque (creación v2).
      if (typeof b.uuid === "string" && b.uuid.toUpperCase() === uuidUp) return true;
      // Shape 2: documents como array de strings o de objetos {uuid}.
      if (!Array.isArray(b.documents)) return false;
      return b.documents.some((d) => {
        if (typeof d === "string") return d.toUpperCase() === uuidUp;
        return typeof d?.uuid === "string" && d.uuid.toUpperCase() === uuidUp;
      });
    });
    if (!referencia) {
      return {
        ok: false,
        message: `La factura sustituta no referencia a la factura original con relación SAT 04 (UUID ${uuidOriginal}). Cancela la sustituta con motivo 02 y vuelve a timbrarla desde el asistente de sustitución para que FacturAPI incluya la relación 04 correcta.`,
        remoteRelated: bloques,
      };
    }
    return { ok: true };
  } catch (_err) {
    // Si la consulta falla (red, permisos), no bloqueamos: dejamos que la
    // cancelación intente y devuelva el error real de FacturAPI.
    return { ok: true };
  }
}

/**
 * Resuelve UUID + facturapi_id de la sustituta a partir de su factura_id local.
 * Ola 4 · N38: expone `organizationId` para que el handler rechace sustitutas
 * de OTRA organización (antes se podía grabar `sustituida_por` cross-tenant).
 */
export async function resolveSustitutaSnapshot(
  supabase: SupabaseClient,
  sustituidaPorFacturaId: string,
): Promise<
  | { ok: true; uuid: string; facturapiId: string; organizationId: string }
  | { ok: false }
> {
  const { data } = await supabase
    .from("facturas")
    .select("id, uuid_fiscal, facturapi_id, organization_id")
    .eq("id", sustituidaPorFacturaId)
    .maybeSingle();
  if (!data?.uuid_fiscal || !data.facturapi_id) return { ok: false };
  return { ok: true, uuid: data.uuid_fiscal as string, facturapiId: data.facturapi_id as string, organizationId: data.organization_id as string };
}

