/**
 * Helpers internos para `parseCfdi.ts`. Aislamos aquí el mapeo
 * `error → InvokeAttempt` (FunctionsHttpError / FunctionsFetchError /
 * FunctionsRelayError) para que `parseCfdi.ts` se quede en lógica de
 * orquestación (reintentos + Sentry + wrap) y < 200 líneas.
 */
import {
  FunctionsHttpError,
  FunctionsRelayError,
  FunctionsFetchError,
} from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { CfdiParsedResponse, CfdiUploadPhase } from "./parseCfdi.types";

export interface InvokeAttemptOk {
  ok: true;
  data: CfdiParsedResponse;
}
export interface InvokeAttemptFail {
  ok: false;
  retryable: boolean;
  phase: CfdiUploadPhase;
  errorName: string;
  status: number | null;
  message: string;
  cause: unknown;
}
export type InvokeAttempt = InvokeAttemptOk | InvokeAttemptFail;

const RETRYABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);

async function mapHttpError(error: FunctionsHttpError): Promise<InvokeAttemptFail> {
  const ctx = error.context as Response | undefined;
  const status = ctx?.status ?? null;
  let serverMsg = `parse-cfdi-xml respondió HTTP ${status ?? "?"}`;
  try {
    const body = await ctx?.clone().json();
    if (body?.error) serverMsg = body.error;
  } catch {
    /* body no-JSON */
  }
  return {
    ok: false,
    retryable: status !== null && RETRYABLE_HTTP.has(status),
    phase: "response",
    errorName: "FunctionsHttpError",
    status,
    message: serverMsg,
    cause: error,
  };
}

async function mapError(error: unknown): Promise<InvokeAttemptFail> {
  if (error instanceof FunctionsHttpError) return mapHttpError(error);
  if (error instanceof FunctionsRelayError) {
    return {
      ok: false,
      retryable: true,
      phase: "preflight",
      errorName: "FunctionsRelayError",
      status: null,
      message: error.message || "Gateway bloqueó la llamada",
      cause: error,
    };
  }
  if (error instanceof FunctionsFetchError) {
    return {
      ok: false,
      retryable: true,
      phase: "request",
      errorName: "FunctionsFetchError",
      status: null,
      message: error.message || "No se pudo contactar el servidor",
      cause: error,
    };
  }
  const name = (error as Error)?.name ?? "UnknownError";
  const msg = (error as Error)?.message ?? "Error desconocido al invocar la función";
  return {
    ok: false,
    retryable: true,
    phase: "request",
    errorName: name,
    status: null,
    message: msg,
    cause: error,
  };
}

export async function invokeParseCfdiOnce(
  file: File,
  categorias: { id: string; nombre: string }[],
  organizationId: string,
): Promise<InvokeAttempt> {
  // FormData fresco por intento: el body se consume al enviar.
  const formData = new FormData();
  formData.append("file", file);
  formData.append("categorias", JSON.stringify(categorias));

  try {
    const { data, error } = await supabase.functions.invoke<CfdiParsedResponse>(
      "parse-cfdi-xml",
      // La organización objetivo viaja en header para que la edge function
      // autorice antes de leer el multipart.
      { body: formData, headers: { "x-organization-id": organizationId } },
    );
    if (error) return mapError(error);
    if (!data) {
      return {
        ok: false,
        retryable: false,
        phase: "response",
        errorName: "EmptyResponse",
        status: 200,
        message: "El servidor devolvió respuesta vacía",
        cause: null,
      };
    }
    return { ok: true, data };
  } catch (err) {
    return mapError(err);
  }
}
