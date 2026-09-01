import { supabase } from "@/integrations/supabase/client";
import {
  FacturapiError,
  parseFunctionError,
  toReadableError,
  type EdgeErrorBody,
} from "./facturapiError";

export { FacturapiError, parseFunctionError };
;

export interface TimbradoResult {
  uuid: string;
  folio: number;
  serie: string;
  facturapi_id: string;
  pdf_url: string;
  xml_url: string;
}

export async function emitirFacturapi(facturaId: string): Promise<TimbradoResult> {
  const { data, error } = await supabase.functions.invoke<TimbradoResult & EdgeErrorBody>(
    "facturapi-emitir",
    { body: { factura_id: facturaId } },
  );
  if (error) {
    const body = await parseFunctionError(error);
    throw toReadableError(error, body, "No se pudo timbrar la factura.");
  }
  if (data?.error) {
    throw toReadableError(null, data, data.error);
  }
  return data as TimbradoResult;
}

export type MotivoCancelacionSat = "01" | "02" | "03" | "04";

export interface CancelarFacturapiResult {
  /** true → cancelación aceptada terminal, sustitución consolidada. */
  sustituida: boolean;
  pending: boolean; // SAT `pending`/`verifying`: el receptor tiene hasta 72 h
  uncertain?: boolean; // timeout con `verifying` persistido: incierto, NO reintentar

  cancellation_status?: string; // accepted|pending|verifying|rejected|expired|none
  /** ISO con la fecha estimada de vencimiento del silencio positivo. */
  vence_en?: string | null;
  /** Mensaje humano listo para toast. */
  message?: string;
}

/**
 * S.3 (N-4): error tipado cuando la factura aún tiene REPs (complementos de pago) vivos.
 * La guarda existe en BD (`LC_FACTURA_CON_REP_VIVO`), pero un pre-check local
 * evita el roundtrip y da un mensaje accionable con el conteo exacto.
 */
export class FacturaConRepsVivosError extends Error {
  code = "LC_FACTURA_CON_REP_VIVO" as const;
  constructor(public readonly cantidad: number) {
    super(
      cantidad === 1
        ? "No se puede cancelar: la factura tiene 1 complemento de pago (REP) vigente. Cancela primero el REP."
        : `No se puede cancelar: la factura tiene ${cantidad} complementos de pago (REP) vigentes. Cancélalos primero.`,
    );
    this.name = "FacturaConRepsVivosError";
  }
}

async function assertSinRepsVivos(facturaId: string): Promise<void> {
  try {
    const { count, error } = await supabase
      .from("pagos_factura")
      .select("id", { count: "exact", head: true })
      .eq("factura_id", facturaId)
      .not("uuid_rep", "is", null)
      .is("rep_cancelado_en", null)
      .is("deleted_at", null);
    if (error) return; // defensa temprana; si falla, la BD lo bloqueará igual
    if ((count ?? 0) > 0) throw new FacturaConRepsVivosError(count ?? 0);
  } catch (err) {
    if (err instanceof FacturaConRepsVivosError) throw err;
    // Cualquier otro error en el pre-check no debe bloquear la cancelación;
    // la guarda de BD (LC_FACTURA_CON_REP_VIVO) sigue siendo la fuente de verdad.
  }
}


export async function cancelarFacturapi(
  facturaId: string,
  motivo: MotivoCancelacionSat,
  sustituyeUuid?: string,
  sustituidaPorFacturaId?: string,
): Promise<CancelarFacturapiResult> {
  await assertSinRepsVivos(facturaId);

  const { data, error } = await supabase.functions.invoke<
    {
      ok?: boolean;
      sustituida?: boolean;
      pending?: boolean;
      uncertain?: boolean;
      cancellation_status?: string;
      vence_en?: string | null;
      message?: string;
    } & EdgeErrorBody
  >("facturapi-cancelar", {
    body: {
      factura_id: facturaId,
      motivo,
      sustituye_uuid: sustituyeUuid,
      sustituida_por_factura_id: sustituidaPorFacturaId,
    },
  });
  if (error) {
    const body = await parseFunctionError(error);
    throw toReadableError(error, body, "No se pudo cancelar la factura.");
  }
  if (data?.error) {
    throw toReadableError(null, data, data.error);
  }
  return {
    sustituida: !!data?.sustituida,
    pending: !!data?.pending,
    uncertain: !!data?.uncertain,
    cancellation_status: data?.cancellation_status,
    vence_en: data?.vence_en ?? null,
    message: data?.message,
  };
}

/**
 * Reintenta descargar el acuse SAT de una factura ya cancelada.
 * Invoca `facturapi-cancelar` con la bandera `solo_descargar_acuse: true`,
 * que salta la llamada `invoices.cancel(...)` y sólo actualiza los campos
 * `acuse_cancelacion_xml/fecha/status` en la fila.
 */
export async function reintentarAcuseCancelacion(
  facturaId: string,
): Promise<{ acuse_status: string; acuse_guardado: boolean }> {
  const { data, error } = await supabase.functions.invoke<
    { ok?: boolean; acuse_status?: string; acuse_guardado?: boolean } & EdgeErrorBody
  >(
    "facturapi-cancelar",
    { body: { factura_id: facturaId, solo_descargar_acuse: true } },
  );
  if (error) {
    const body = await parseFunctionError(error);
    throw toReadableError(error, body, "No se pudo descargar el acuse.");
  }
  if (data?.error) {
    throw toReadableError(null, data, data.error);
  }
  return {
    acuse_status: data?.acuse_status ?? "pending",
    acuse_guardado: !!data?.acuse_guardado,
  };
}

/**
 * Descarga el PDF OFICIAL del acuse SAT desde FacturApi
 * (`/invoices/{id}/cancellation_receipt/pdf`). No se persiste en BD; el
 * backend nos entrega el binario y aquí lo devolvemos como `Blob` para que
 * el navegador dispare la descarga.
 */
export async function descargarAcuseCancelacionPdf(facturaId: string): Promise<Blob> {
  const { data, error } = await supabase.functions.invoke<Blob>("facturapi-cancelar", {
    body: { factura_id: facturaId, solo_descargar_acuse_pdf: true },
  });
  if (error) {
    const body = await parseFunctionError(error);
    throw toReadableError(error, body, "No se pudo descargar el PDF del acuse.");
  }
  if (!(data instanceof Blob)) {
    throw new Error("La respuesta no es un PDF válido.");
  }
  return data;
}

/**
 * Clona una factura timbrada como borrador para sustituirla (motivo SAT 01).
 * Devuelve el ID de la factura clonada (estado `Borrador`, con `sustituye_a` enlazado).
 */
export async function duplicarFacturaParaSustitucion(facturaId: string): Promise<string> {
  // SAFE-CAST: RPC tipada en supabase/types.ts retorna uuid de la nueva factura.
  const { data, error } = await supabase.rpc("duplicar_factura_para_sustitucion", {
    p_factura_id: facturaId,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No se pudo duplicar la factura para sustitución.");
  return data as string;
}

// consultarEstadoFacturapi() vive en ./facturapiConsultar.ts (split Power-of-10).
export type {
  ConsultarFacturapiResult,
  ConsultarFacturapiRep,
  ConsultarFacturapiXml,
  EstatusSatConsulta,
} from "./facturapiConsultar";
export { consultarEstadoFacturapi } from "./facturapiConsultar";
