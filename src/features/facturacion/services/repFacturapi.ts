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
import { type TimbradoPendiente } from "./timbradoPendiente";
import { interpretarTimbrado } from "./timbradoParse";
import type { TimbradoExitoWire, TimbradoWire } from "./timbradoWire";

/** Mismo contrato wire de éxito que la factura (seis campos del timbre). */
export type RepTimbradoResult = TimbradoExitoWire;


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

/** Timbre listo o 202 "pendiente" (sin UUID/folio, el pago sigue sin REP). */
export type RepTimbradoRespuesta = RepTimbradoResult | TimbradoPendiente;

export async function emitirRep(pagoId: string): Promise<RepTimbradoRespuesta> {
  const { data, error } = await supabase.functions.invoke<TimbradoWire>(
    "facturapi-emitir-rep",
    { body: { pago_id: pagoId } },
  );
  if (error) {
    lanzarErrorRep(await parseFunctionError(error), error, "No se pudo timbrar el REP.");
  }
  // Mismo parser que la factura: error → pendiente (202) → éxito validado.
  return interpretarTimbrado(data, "El timbrado del REP", (body) => {
    lanzarErrorRep(body, null, "No se pudo timbrar el REP.");
  });
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
