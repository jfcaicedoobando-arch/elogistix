/**
 * Respaldo automático de XML timbrado en el bucket privado `facturas`.
 * Best-effort: si falla, devuelve status "error" y NO interrumpe el timbrado.
 *
 * Vive en `_shared/` fuera de los `index.ts` de las edge functions FacturApi
 * porque el guardrail `facturapi-multi-tenant.test.ts` prohíbe usar
 * `basicAuthHeader` dentro de esas funciones (auth vía SDK).
 *
 * Ola 3 · Item 5 — extendido a NC y REP (v13.192.0).
 */
import { FACTURAPI_BASE, basicAuthHeader } from "./facturapiAuth.ts";

// Cliente storage tipado mínimo — evita acoplarnos al createClient del caller.
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

export type XmlBackupFolder = "emitidas" | "notas-credito" | "rep";

export interface RespaldoResult {
  path: string | null;
  status: "ok" | "skipped" | "error";
  error?: string;
}

export async function respaldarXmlTimbrado(params: {
  supabase: StorageClient;
  apiKey: string;
  facturapiId: string;
  organizationId: string;
  uuid: string;
  folder: XmlBackupFolder;
}): Promise<RespaldoResult> {
  try {
    const res = await fetch(`${FACTURAPI_BASE}/invoices/${params.facturapiId}/xml`, {
      headers: { Authorization: basicAuthHeader(params.apiKey) },
    });
    if (!res.ok) {
      return { path: null, status: "error", error: `facturapi_${res.status}` };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `${params.organizationId}/${params.folder}/${params.uuid}.xml`;
    const { error } = await params.supabase.storage.from("facturas").upload(path, bytes, {
      contentType: "application/xml",
      upsert: true,
    });
    if (error) {
      const msg = (error as { message?: string }).message ?? "upload_error";
      return { path: null, status: "error", error: msg };
    }
    return { path, status: "ok" };
  } catch (e) {
    return { path: null, status: "error", error: (e as Error).message };
  }
}
