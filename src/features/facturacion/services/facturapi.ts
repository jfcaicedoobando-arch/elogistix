import { supabase } from "@/integrations/supabase/client";

export interface TimbradoResult {
  uuid: string;
  folio: number;
  serie: string;
  facturapi_id: string;
  pdf_url: string;
  xml_url: string;
}

export interface ValidationIssue { field: string; message: string }

interface EdgeErrorBody {
  error?: string;
  message?: string;
  issues?: ValidationIssue[];
  transient?: boolean;
}

/** Error enriquecido: expone si el fallo es transitorio (reintentable). */
export class FacturapiError extends Error {
  transient: boolean;
  constructor(message: string, transient = false) {
    super(message);
    this.name = "FacturapiError";
    this.transient = transient;
  }
}

/**
 * `supabase.functions.invoke()` levanta `FunctionsHttpError` en cualquier
 * status ≠ 2xx y NO expone el JSON del body en `data` — sólo deja
 * `error.message = "Edge Function returned a non-2xx status code"` y el
 * cuerpo real en `error.context` (una `Response`). Esta función lo lee para
 * que el usuario vea el mensaje amable del backend (ej. "Esta organización
 * no tiene FacturApi configurado…") en lugar de la cadena genérica.
 */
export async function parseFunctionError(error: unknown): Promise<EdgeErrorBody> {
  const ctx = (error as { context?: unknown } | null)?.context;
  if (ctx && typeof (ctx as Response).clone === "function") {
    try {
      const body = await (ctx as Response).clone().json();
      if (body && typeof body === "object") return body as EdgeErrorBody;
    } catch {
      // Body no era JSON parseable; caemos al fallback.
    }
  }
  return {};
}

function toReadableError(error: unknown, body: EdgeErrorBody, fallback: string): Error {
  const issues = body.issues?.length
    ? `: ${body.issues.map((i) => i.message).join("; ")}`
    : "";
  const message = body.message
    ?? body.error
    ?? (error as { message?: string } | null)?.message
    ?? fallback;
  return new FacturapiError(message + issues, !!body.transient);
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
  /** true → SAT devolvió `pending`/`verifying`; el receptor tiene hasta 72 h. */
  pending: boolean;
  /** Estado remoto textual: accepted | pending | verifying | rejected | expired | none. */
  cancellation_status?: string;
  /** ISO con la fecha estimada de vencimiento del silencio positivo. */
  vence_en?: string | null;
  /** Mensaje humano listo para toast. */
  message?: string;
}

export async function cancelarFacturapi(
  facturaId: string,
  motivo: MotivoCancelacionSat,
  sustituyeUuid?: string,
  sustituidaPorFacturaId?: string,
): Promise<CancelarFacturapiResult> {
  const { data, error } = await supabase.functions.invoke<
    {
      ok?: boolean;
      sustituida?: boolean;
      pending?: boolean;
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
  ConsultarFacturapiRelacionado,
  ConsultarFacturapiResult,
} from "./facturapiConsultar";
export { consultarEstadoFacturapi } from "./facturapiConsultar";



