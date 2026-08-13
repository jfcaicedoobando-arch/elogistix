/**
 * verificacion — Orquesta la verificación documental de una factura:
 * descarga el XML del CFDI y de cada REP timbrado, los compara contra la BD y
 * consulta el estatus real en el SAT. Además reconcilia el REP local cuando el
 * SAT/FacturApi lo reportan cancelado y la BD todavía no.
 */
import { FACTURAPI_BASE, basicAuthHeader } from "../_shared/facturapiAuth.ts";
import type { EstatusSat } from "../_shared/satConsulta.ts";
import {
  CFDI_META_VACIO,
  compararFacturaXml,
  compararRepXml,
  descargarXml,
  leerMetaCfdi,
  leerPagoComplemento,
  verificarSat,
  type CfdiMeta,
  type FacturaComparable,
} from "./xmlSat.ts";

interface SupabaseMin {
  from: (t: string) => {
    select: (c: string) => {
      eq: (c: string, v: string) => {
        eq: (c: string, v: string) => { order: (c: string, o: { ascending: boolean }) => PromiseLike<{ data: unknown; error: unknown }> };
      };
    };
    update: (p: Record<string, unknown>) => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> };
  };
}

export interface XmlVerificado extends CfdiMeta {
  disponible: boolean;
  estatus_sat: EstatusSat;
  sat_detalle: string;
  diferencias: string[];
  error: string | null;
}

export interface RepVerificado {
  pago_id: string;
  folio: string | null;
  fecha_pago: string | null;
  estado_rep: string | null;
  rep_cancellation_status: string | null;
  remoto_cancellation_status: string | null;
  remoto_status: string | null;
  uuid: string | null;
  monto: number | null;
  moneda: string | null;
  estatus_sat: EstatusSat;
  diferencias: string[];
  reconciliado: boolean;
  error: string | null;
}

interface PagoRow {
  id: string;
  facturapi_rep_id: string | null;
  uuid_rep: string | null;
  serie_rep: string | null;
  folio_rep: number | null;
  fecha_pago: string | null;
  monto: number | null;
  moneda: string | null;
  estado_rep: string | null;
  rep_cancellation_status: string | null;
}

const REP_FETCH_TIMEOUT_MS = 15_000;

async function remotoRep(apiKey: string, id: string): Promise<{ status: string | null; cancellation_status: string | null }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REP_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${FACTURAPI_BASE}/invoices/${id}`, {
      headers: { Authorization: basicAuthHeader(apiKey) },
      signal: ctrl.signal,
    });
    if (!res.ok) {
      await res.text();
      return { status: null, cancellation_status: null };
    }
    const body = await res.json() as { status?: string; cancellation_status?: string };
    return {
      status: (body.status ?? "").toLowerCase() || null,
      cancellation_status: (body.cancellation_status ?? "").toLowerCase() || null,
    };
  } catch {
    return { status: null, cancellation_status: null };
  } finally {
    clearTimeout(timer);
  }
}

/** Verifica el XML de la factura emitida y su estatus en el SAT. */
export async function verificarXmlFactura(
  apiKey: string,
  facturapiId: string,
  bd: FacturaComparable,
): Promise<XmlVerificado> {
  try {
    const xml = await descargarXml(apiKey, facturapiId);
    const meta = leerMetaCfdi(xml);
    const sat = await verificarSat(meta);
    return {
      ...meta,
      disponible: true,
      estatus_sat: sat.estatus,
      sat_detalle: sat.raw,
      diferencias: compararFacturaXml(meta, bd),
      error: null,
    };
  } catch (err) {
    return {
      ...CFDI_META_VACIO,
      disponible: false,
      estatus_sat: "Error",
      sat_detalle: "",
      diferencias: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function folioRep(p: PagoRow): string | null {
  if (p.folio_rep == null) return null;
  return `${p.serie_rep ?? ""}${p.folio_rep}`;
}

/** ¿Hay que marcar el REP local como cancelado? */
function debeCancelarse(remoto: { status: string | null; cancellation_status: string | null }, sat: EstatusSat, local: PagoRow): boolean {
  const yaCancelado = (local.rep_cancellation_status ?? "").toLowerCase() === "accepted";
  const cancelado = remoto.cancellation_status === "accepted" || remoto.status === "canceled" || sat === "Cancelado";
  return cancelado && !yaCancelado;
}

async function verificarRep(supabase: SupabaseMin, apiKey: string, p: PagoRow): Promise<RepVerificado> {
  const base: RepVerificado = {
    pago_id: p.id,
    folio: folioRep(p),
    fecha_pago: p.fecha_pago ?? null,
    estado_rep: p.estado_rep ?? null,
    rep_cancellation_status: (p.rep_cancellation_status ?? "none").toLowerCase(),
    remoto_cancellation_status: null,
    remoto_status: null,
    uuid: p.uuid_rep ?? null,
    monto: p.monto ?? null,
    moneda: p.moneda ?? null,
    estatus_sat: "No verificable",
    diferencias: [],
    reconciliado: false,
    error: null,
  };
  const repId = p.facturapi_rep_id!;
  try {
    const [xml, remoto] = await Promise.all([descargarXml(apiKey, repId), remotoRep(apiKey, repId)]);
    const meta = leerMetaCfdi(xml);
    const pagoXml = leerPagoComplemento(xml);
    const sat = await verificarSat(meta);
    const diferencias = compararRepXml(meta, pagoXml, {
      uuid_rep: p.uuid_rep ?? null,
      monto: p.monto ?? null,
      moneda: p.moneda ?? null,
    });
    let reconciliado = false;
    if (debeCancelarse(remoto, sat.estatus, p)) {
      const { error } = await supabase
        .from("pagos_factura")
        .update({
          estado_rep: "Cancelado",
          rep_cancellation_status: "accepted",
          rep_cancelado_en: new Date().toISOString(),
        })
        .eq("id", p.id);
      reconciliado = !error;
    }
    return {
      ...base,
      uuid: meta.uuid ?? base.uuid,
      remoto_cancellation_status: remoto.cancellation_status,
      remoto_status: remoto.status,
      estatus_sat: sat.estatus,
      diferencias,
      reconciliado,
    };
  } catch (err) {
    return { ...base, estatus_sat: "Error", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Verifica todos los REPs timbrados de la factura (incluidos los cancelados). */
export async function verificarReps(
  supabase: SupabaseMin,
  apiKey: string,
  facturaId: string,
  organizationId: string,
): Promise<RepVerificado[]> {
  const { data } = await supabase
    .from("pagos_factura")
    .select("id, facturapi_rep_id, uuid_rep, serie_rep, folio_rep, fecha_pago, monto, moneda, estado_rep, rep_cancellation_status")
    .eq("factura_id", facturaId)
    .eq("organization_id", organizationId)
    .order("fecha_pago", { ascending: true });
  const pagos = ((data ?? []) as PagoRow[]).filter(
    (p) => !!p.facturapi_rep_id && !p.facturapi_rep_id.startsWith("PENDING:"),
  );
  const out: RepVerificado[] = [];
  // Secuencial: cada REP hace 2 llamadas a FacturApi + 1 al SAT; el paralelismo
  // masivo dispara rate limits y agota el tiempo de la edge function.
  for (const p of pagos) out.push(await verificarRep(supabase, apiKey, p));
  return out;
}

/** Divergencias legibles para la lista global del diálogo. */
export function divergenciasDocumentales(xml: XmlVerificado | null, reps: RepVerificado[]): string[] {
  const out: string[] = [];
  if (xml?.error) out.push(`XML de la factura: no se pudo descargar (${xml.error})`);
  for (const d of xml?.diferencias ?? []) out.push(`Factura · ${d}`);
  if (xml && xml.estatus_sat === "Cancelado") out.push("SAT: la factura está CANCELADA en el SAT.");
  for (const r of reps) {
    const ref = r.folio ? `REP ${r.folio}` : `REP ${r.pago_id.slice(0, 8)}`;
    if (r.error) out.push(`${ref}: no se pudo verificar el XML (${r.error})`);
    for (const d of r.diferencias) out.push(`${ref} · ${d}`);
    if (r.estatus_sat === "Cancelado" && r.rep_cancellation_status !== "accepted" && !r.reconciliado) {
      out.push(`${ref}: cancelado en el SAT pero vigente en Libre Carga.`);
    }
  }
  return out;
}
