/**
 * Wrapper histórico: la implementación se movió a
 * `_shared/respaldarXmlTimbrado.ts` para compartirla entre las 3 funciones
 * de timbrado (factura, nota de crédito y REP).
 *
 * Se conserva este archivo por compatibilidad con `facturapi-emitir/index.ts`.
 * Ola 3 · Item 5 — extendido a NC y REP (v13.192.0).
 */
import { respaldarXmlTimbrado, type RespaldoResult } from "../_shared/respaldarXmlTimbrado.ts";

interface StorageClient {
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: Uint8Array,
        opts?: { contentType?: string; upsert?: boolean },
      ) => Promise<{ data: unknown; error: unknown }>;
    };
  };
}

export type { RespaldoResult };

export function respaldarXmlEmitido(params: {
  supabase: StorageClient;
  apiKey: string;
  facturapiId: string;
  organizationId: string;
  facturaId: string;
  uuid: string;
}): Promise<RespaldoResult> {
  return respaldarXmlTimbrado({
    supabase: params.supabase,
    apiKey: params.apiKey,
    facturapiId: params.facturapiId,
    organizationId: params.organizationId,
    uuid: params.uuid,
    folder: "emitidas",
  });
}
