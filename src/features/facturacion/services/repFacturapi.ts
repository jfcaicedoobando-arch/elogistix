/**
 * Servicio cliente para timbrado y cancelación del REP (Complemento de Pagos).
 *
 * v13.549.0 — `supabase.functions.invoke()` lanza `FunctionsHttpError` en
 * cualquier status ≠ 2xx y deja `data = null`, así que el mensaje amable que
 * devuelve la edge function (409 "Este pago ya tiene REP timbrado", 422 con
 * las validaciones fiscales) se perdía y el usuario sólo veía la cadena
 * genérica del SDK. Aquí se lee el cuerpo real con `parseFunctionError`.
 */
import { supabase } from "@/integrations/supabase/client";
import { parseFunctionError, toReadableError, type EdgeErrorBody } from "./facturapiError";

export interface RepTimbradoResult {
  uuid: string;
  folio: number;
  serie: string;
  facturapi_id: string;
  pdf_url: string;
  xml_url: string;
}


/**
 * El pago ya tenía REP (o hay un timbrado en curso). No es un fallo del
 * usuario: la pantalla simplemente estaba desactualizada, así que la UI lo
 * trata como aviso informativo y refresca los datos.
 */
export class RepYaTimbradoError extends Error {
  readonly code = "ya_timbrado_rep" as const;
  /** `true` cuando quedó un claim `PENDING:` (timbrado interrumpido). */
  claimPendiente: boolean;
  constructor(message: string, claimPendiente = false) {
    super(message);
    this.name = "RepYaTimbradoError";
    this.claimPendiente = claimPendiente;
  }
}

export function esRepYaTimbrado(err: unknown): boolean {
  return err instanceof RepYaTimbradoError;
}

function lanzarErrorRep(body: EdgeErrorBody, error: unknown, fallback: string): never {
  if (body.error === "ya_timbrado_rep") {
    const claim = (body as { claim_pendiente?: boolean }).claim_pendiente === true;
    throw new RepYaTimbradoError(body.message ?? "Este pago ya tiene REP timbrado.", claim);
  }
  throw toReadableError(error, body, fallback);
}

export async function emitirRep(pagoId: string): Promise<RepTimbradoResult> {
  const { data, error } = await supabase.functions.invoke<RepTimbradoResult & EdgeErrorBody>(
    "facturapi-emitir-rep",
    { body: { pago_id: pagoId } },
  );
  if (error) {
    lanzarErrorRep(await parseFunctionError(error), error, "No se pudo timbrar el REP.");
  }
  if (data?.error) {
    lanzarErrorRep(data, null, "No se pudo timbrar el REP.");
  }
  return data as RepTimbradoResult;
}

export type MotivoCancelacionSat = "01" | "02" | "03" | "04";

export interface CancelarRepResult {
  ok: boolean;
  pending: boolean;
  /** true → timeout con `verifying` persistido: resultado incierto, NO reintentar. */
  uncertain: boolean;
  cancellation_status: string;
  message: string | null;
}

export async function cancelarRep(
  pagoId: string,
  motivo: MotivoCancelacionSat,
  sustituyeUuid?: string,
): Promise<CancelarRepResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    pending?: boolean;
    uncertain?: boolean;
    cancellation_status?: string;
    message?: string;
  } & EdgeErrorBody>(
    "facturapi-cancelar-rep",
    // Ola 13 · R4P-01 (retiro): la relación con el REP cancelado se evidencia
    // con `rep_cancelado_*` y el XML del REP nuevo, no con una segunda
    // cancelación motivo 01.
    { body: { pago_id: pagoId, motivo, sustituye_uuid: sustituyeUuid } },
  );
  if (error) {
    lanzarErrorRep(await parseFunctionError(error), error, "No se pudo cancelar el REP.");
  }
  if (data?.error) {
    lanzarErrorRep(data, null, "No se pudo cancelar el REP.");
  }
  return {
    ok: data?.ok === true,
    pending: data?.pending === true,
    uncertain: data?.uncertain === true,
    cancellation_status: data?.cancellation_status ?? "accepted",
    message: data?.message ?? null,
  };
}
