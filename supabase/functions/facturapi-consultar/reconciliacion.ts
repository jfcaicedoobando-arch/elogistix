/**
 * Helpers de consulta/reconciliación para `facturapi-consultar`.
 * Separado del handler para respetar el límite de líneas por archivo.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getFacturapiClient } from "../_shared/facturapiClient.ts";
import { registrarBitacoraEdge } from "../_shared/bitacora.ts";
import { jsonResponse } from "../_shared/response.ts";
import { resolveFacturapiKey } from "../_shared/facturapiAuth.ts";
import {
  divergenciasDocumentales,
  verificarReps,
  verificarXmlFactura,
  type RepVerificado,
  type XmlVerificado,
} from "./verificacion.ts";

export interface FapiInvoiceStatus {
  status?: string;
  cancellation_status?: string;
}
interface FacturaPendiente {
  cancellation_status: string;
  sustituida_por: string | null;
}
interface ResolvedPatch {
  outcome: "accepted" | "rejected" | "expired" | "transition" | "no_change";
  patch: Record<string, unknown>;
}

export interface FapiInvoiceRemote extends FapiInvoiceStatus {
  id?: string;
  uuid?: string;
  folio_number?: number;
  series?: string;
  canceled_at?: string | null;
  related_documents?: Array<{
    relationship?: string;
    documents?: Array<string | { uuid?: string; folio_number?: number; series?: string; total?: number }>;
  }>;
}

export interface LocalFactura {
  id: string;
  facturapi_id: string;
  organization_id: string;
  estado: string | null;
  cancellation_status: string | null;
  uuid_fiscal: string | null;
  sustituida_por: string | null;
  total: number | null;
  moneda: string | null;
  rfc_cliente: string | null;
}

export type SBClient = ReturnType<typeof createClient>;

/**
 * Copia local de la lógica de `facturapi-reconciliar-cancelaciones/reconcile.ts`.
 * Supabase bundle-only permite archivos del mismo folder, así que se duplica aquí
 * para no depender de un import cross-folder que rompería el deploy.
 */
export function resolveNextAction(
  remote: FapiInvoiceStatus,
  local: FacturaPendiente,
  nowIso: string,
): ResolvedPatch {
  const cs = (remote.cancellation_status ?? "").toLowerCase();
  // Ola 4 · N18: "aceptada" se evalúa antes del guard de igualdad.
  if (cs === "accepted" || remote.status === "canceled") {
    return {
      outcome: "accepted",
      patch: {
        estado: local.sustituida_por ? "Sustituida" : "Cancelada",
        cancellation_status: "accepted",
        cancelado_en: nowIso,
      },
    };
  }
  if (cs === local.cancellation_status) return { outcome: "no_change", patch: {} };
  if (cs === "rejected" || cs === "expired") {
    return {
      outcome: cs,
      patch: { cancellation_status: cs, cancelacion_solicitada_en: null, cancelacion_vence_en: null },
    };
  }
  if (cs && cs !== local.cancellation_status) {
    return { outcome: "transition", patch: { cancellation_status: cs } };
  }
  return { outcome: "no_change", patch: {} };
}

export async function loadFactura(supabase: SBClient, facturaId: string): Promise<
  { ok: true; factura: LocalFactura } | { ok: false; res: Response }
> {
  const { data, error } = await supabase
    .from("facturas")
    .select("id, facturapi_id, organization_id, estado, cancellation_status, uuid_fiscal, sustituida_por, total, moneda, rfc_cliente, deleted_at")
    .eq("id", facturaId)
    .maybeSingle();
  if (error || !data) return { ok: false, res: jsonResponse({ error: "factura_not_found" }, 404) };
  if (data.deleted_at) {
    return { ok: false, res: jsonResponse({ error: "factura_eliminada", message: "La factura fue eliminada." }, 404) };
  }
  if (!data.facturapi_id) return { ok: false, res: jsonResponse({ error: "no_timbrada" }, 409) };
  return { ok: true, factura: data as LocalFactura };
}

export async function fetchRemote(supabase: SBClient, factura: LocalFactura): Promise<
  { ok: true; remote: FapiInvoiceRemote } | { ok: false; res: Response }
> {
  const resolved = await getFacturapiClient(supabase, factura.organization_id);
  if (!resolved.ok) {
    return {
      ok: false,
      res: jsonResponse({ error: resolved.data.error, message: resolved.data.message }, resolved.data.status),
    };
  }
  try {
    const client = resolved.data.client as { invoices: { retrieve: (id: string) => Promise<unknown> } };
    const remote = await client.invoices.retrieve(factura.facturapi_id) as FapiInvoiceRemote;
    return { ok: true, remote };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, res: jsonResponse({ error: "facturapi_error", message: detail }, 502) };
  }
}

export function computeDivergencias(remote: FapiInvoiceRemote, factura: LocalFactura): string[] {
  const remoteStatus = (remote.status ?? "").toLowerCase();
  const remoteCancellation = (remote.cancellation_status ?? "none").toLowerCase();
  const localCancellation = (factura.cancellation_status ?? "none").toLowerCase();
  const localEstado = (factura.estado ?? "").toLowerCase();
  const out: string[] = [];
  if (remoteCancellation !== localCancellation) {
    out.push(`cancellation_status: BD='${localCancellation}' ≠ FacturApi='${remoteCancellation}'`);
  }
  if (remoteStatus === "canceled" && localEstado !== "cancelada" && localEstado !== "sustituida") {
    out.push(`status: BD='${localEstado}' ≠ FacturApi='${remoteStatus}'`);
  }
  return out;
}

export async function reconciliarSiAplica(
  supabase: SBClient,
  factura: LocalFactura,
  remote: FapiInvoiceRemote,
  divergencias: string[],
  user: { id: string; email?: string },
): Promise<boolean> {
  if (divergencias.length === 0) return false;
  const decision = resolveNextAction(
    remote,
    {
      cancellation_status: (factura.cancellation_status ?? "none").toLowerCase(),
      sustituida_por: factura.sustituida_por ?? null,
    },
    new Date().toISOString(),
  );
  if (decision.outcome === "no_change" || Object.keys(decision.patch).length === 0) return false;
  const { error: updErr } = await supabase.from("facturas").update(decision.patch).eq("id", factura.id);
  if (updErr) return false;
  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id,
    usuarioId: user.id,
    usuarioEmail: user.email,
    modulo: "facturacion",
    accion: "facturapi_consulta_reconciliada",
    entidadId: factura.id,
    detalles: { outcome: decision.outcome, patch: decision.patch, divergencias },
  });
  return true;
}

function flattenRelated(remote: FapiInvoiceRemote) {
  return (remote.related_documents ?? []).flatMap((rel) => {
    const docs = rel.documents ?? [];
    return docs.map((d) => (typeof d === "string"
      ? { relationship: rel.relationship ?? null, id: d }
      : {
          relationship: rel.relationship ?? null,
          uuid: d.uuid ?? null,
          folio: d.folio_number ?? null,
          serie: d.series ?? null,
          total: d.total ?? null,
        }));
  });
}

export function buildResponse(
  factura: LocalFactura,
  remote: FapiInvoiceRemote,
  divergencias: string[],
  reconciliada: boolean,
) {
  return {
    ok: true,
    reconciliada,
    divergencias,
    remoto: {
      status: (remote.status ?? "").toLowerCase() || null,
      cancellation_status: (remote.cancellation_status ?? "none").toLowerCase(),
      canceled_at: remote.canceled_at ?? null,
      uuid: remote.uuid ?? null,
      folio: remote.folio_number ?? null,
      serie: remote.series ?? null,
      related_documents: flattenRelated(remote),
    },
    local: {
      estado: factura.estado,
      cancellation_status: (factura.cancellation_status ?? "none").toLowerCase(),
      uuid_fiscal: factura.uuid_fiscal ?? null,
    },
  };
}

interface Documental {
  xml: XmlVerificado | null;
  reps: RepVerificado[];
  divergencias: string[];
}

/**
 * Verificación documental: XML de la factura + XML de cada REP timbrado y su
 * estatus real en el SAT. Nunca tumba la respuesta: si FacturApi no entrega la
 * API key o el XML, se devuelve `xml: null` y la lista de REPs vacía.
 */
export async function verificarDocumentos(
  supabase: SBClient,
  factura: LocalFactura,
  user: { id: string; email?: string },
): Promise<Documental> {
  const resolved = await resolveFacturapiKey(
    supabase as unknown as Parameters<typeof resolveFacturapiKey>[0],
    factura.organization_id,
  );
  if (!resolved.ok) return { xml: null, reps: [], divergencias: [] };
  const apiKey = resolved.data.apiKey;
  const sb = supabase as unknown as Parameters<typeof verificarReps>[0];
  const xml = await verificarXmlFactura(apiKey, factura.facturapi_id, {
    uuid_fiscal: factura.uuid_fiscal,
    total: factura.total,
    moneda: factura.moneda,
    rfc_cliente: factura.rfc_cliente,
  });
  const reps = await verificarReps(sb, apiKey, factura.id, factura.organization_id);
  const divergencias = divergenciasDocumentales(xml, reps);
  await registrarBitacoraEdge(supabase, {
    organizationId: factura.organization_id,
    usuarioId: user.id,
    usuarioEmail: user.email,
    modulo: "facturacion",
    accion: "facturapi_consulta_xml_sat",
    entidadId: factura.id,
    detalles: {
      estatus_sat_factura: xml.estatus_sat,
      reps_verificados: reps.length,
      reps_reconciliados: reps.filter((r) => r.reconciliado).length,
      divergencias,
    },
  });
  return { xml, reps, divergencias };
}
