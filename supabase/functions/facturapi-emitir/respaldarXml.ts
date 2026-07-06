/**
 * Descarga el XML timbrado de FacturApi y lo respalda en el bucket privado
 * `facturas` de Storage. Best-effort: si falla no interrumpe el timbrado.
 *
 * Vive fuera de `index.ts` porque el guardrail `facturapi-multi-tenant.test.ts`
 * prohíbe usar `basicAuthHeader` en la edge function principal.
 *
 * Ola 3 · Item 5 — Respaldo automático de XML emitidos.
 */
import { FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";

// Cliente storage tipado mínimo — evita acoplarnos al createClient importado en el caller.
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

export interface RespaldoResult {
  path: string | null;
  status: "ok" | "skipped" | "error";
  error?: string;
}

export async function respaldarXmlEmitido(params: {
  supabase: StorageClient;
  apiKey: string;
  facturapiId: string;
  organizationId: string;
  facturaId: string;
  uuid: string;
}): Promise<RespaldoResult> {
  try {
    const res = await fetch(`${FACTURAPI_BASE}/invoices/${params.facturapiId}/xml`, {
      headers: { Authorization: basicAuthHeader(params.apiKey) },
    });
    if (!res.ok) {
      return { path: null, status: "error", error: `facturapi_${res.status}` };
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    const path = `${params.organizationId}/emitidas/${params.uuid}.xml`;
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
