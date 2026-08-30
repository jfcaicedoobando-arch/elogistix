/**
 * Helpers de carga de datos para facturapi-emitir-nota-credito.
 * Aíslan ramas/`??` para reducir la complejidad ciclomática del handler.
 */
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import type { NotaCreditoContext, ConceptoNC, ReferenciasEmbarque } from "./helpers.ts";

export type SupabaseLike = ReturnType<typeof createClient>;


interface NcRow {
  id: string;
  factura_id: string;
  organization_id: string;
  serie: string | null;
  uso_cfdi: string | null;
  forma_pago: string | null;
  moneda: string | null;
  tipo_cambio: number | string | null;
  conceptos: unknown;
  facturapi_id: string | null;
  estado: string;
}

interface FacturaRow {
  id: string;
  uuid_fiscal: string | null;
  cliente_id: string;
  rfc_cliente: string | null;
  uso_cfdi: string | null;
  forma_pago: string | null;
  embarque_id: string | null;
  expediente: string | null;
  referencia_bl: string | null;
}

interface ClienteRow {
  id: string;
  nombre: string;
  rfc: string | null;
  codigo_postal: string | null;
  regimen_fiscal: string | null;
  uso_cfdi_default: string | null;
}

/**
 * Ola 3 · B — Estados de NC realmente timbrables: la tabla del detalle sólo
 * ofrece "Timbrar" en `Borrador`, y la máquina canónica
 * (`guard_nc_cliente_transicion`) permite además `Aprobada → Timbrada`
 * (legado). Timbrada/Aplicada/Cancelada nunca llegan a FacturAPI.
 */
export const ESTADOS_NC_TIMBRABLES: readonly string[] = ["Borrador", "Aprobada"];

export async function loadNc(supabase: SupabaseLike, id: string): Promise<NcRow | null> {
  const { data } = await supabase
    .from("factura_notas_credito")
    .select("id, factura_id, organization_id, serie, uso_cfdi, forma_pago, moneda, tipo_cambio, conceptos, facturapi_id, estado")
    .eq("id", id)
    // Ola 3 · B: una NC en papelera no es timbrable ni por llamada directa.
    .is("deleted_at", null)
    .maybeSingle();
  return (data as NcRow | null) ?? null;
}


export async function loadFactura(supabase: SupabaseLike, id: string): Promise<FacturaRow | null> {
  const { data } = await supabase
    .from("facturas")
    .select("id, uuid_fiscal, cliente_id, rfc_cliente, uso_cfdi, forma_pago, embarque_id, expediente, referencia_bl")
    .eq("id", id)
    .maybeSingle();
  return (data as FacturaRow | null) ?? null;
}

export async function loadCliente(supabase: SupabaseLike, id: string): Promise<ClienteRow | null> {
  const { data } = await supabase
    .from("clientes")
    .select("id, nombre, rfc, codigo_postal, regimen_fiscal, uso_cfdi_default")
    .eq("id", id)
    .maybeSingle();
  return (data as ClienteRow | null) ?? null;
}

export async function loadEmailPrincipal(supabase: SupabaseLike, clienteId: string): Promise<string | null> {
  // La columna `es_principal` fue removida; tomamos el contacto más antiguo con email.
  const { data } = await supabase
    .from("contactos_cliente")
    .select("email")
    .eq("cliente_id", clienteId)
    .not("email", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return ((data as { email: string | null } | null)?.email) ?? null;
}


export async function loadReferenciasEmbarque(
  supabase: SupabaseLike,
  factura: FacturaRow,
): Promise<ReferenciasEmbarque> {
  let refExpediente: string | null = factura.expediente ?? null;
  let refBlMaster: string | null = null;
  let refBlHouse: string | null = factura.referencia_bl ?? null;
  if (factura.embarque_id) {
    const { data: emb } = await supabase
      .from("embarques")
      .select("expediente, bl_master, bl_house")
      .eq("id", factura.embarque_id)
      .maybeSingle();
    const row = emb as { expediente?: string | null; bl_master?: string | null; bl_house?: string | null } | null;
    if (row) {
      refExpediente = row.expediente ?? refExpediente;
      refBlMaster = row.bl_master ?? null;
      refBlHouse = row.bl_house ?? refBlHouse;
    }
  }
  return { expediente: refExpediente, bl_master: refBlMaster, bl_house: refBlHouse };
}


export function buildNcContextFromRows(
  nc: NcRow,
  factura: FacturaRow,
  cliente: ClienteRow,
  email: string | null,
  referencias: ReferenciasEmbarque | null = null,
): NotaCreditoContext {
  const usoCfdi = nc.uso_cfdi ?? factura.uso_cfdi ?? cliente.uso_cfdi_default ?? "G02";
  const formaPago = nc.forma_pago ?? factura.forma_pago ?? "";
  const moneda = nc.moneda ?? "MXN";
  const taxId = factura.rfc_cliente ?? cliente.rfc ?? "";
  const taxSystem = cliente.regimen_fiscal ?? "";
  const zip = cliente.codigo_postal ?? "";
  const conceptos = (Array.isArray(nc.conceptos) ? nc.conceptos : []) as ConceptoNC[];
  return {
    serie: nc.serie ?? null,
    uso_cfdi: usoCfdi,
    forma_pago: formaPago,
    moneda,
    tipo_cambio: Number(nc.tipo_cambio ?? 1),
    uuid_factura_relacionada: factura.uuid_fiscal as string,
    receptor: {
      legal_name: cliente.nombre,
      tax_id: taxId,
      tax_system: taxSystem,
      address: { zip },
      email,
    },
    conceptos,
    referencias,
  };
}

/**
 * Ola 4 · N1 — claim atómico de timbrado, mismo patrón que `claimFactura`
 * de facturapi-emitir/emitir.ts: reclama la fila poniendo
 * `facturapi_id = PENDING:<uuid>` SÓLO si sigue NULL. Dos requests
 * concurrentes ya no pasan ambos el check-then-act: el segundo UPDATE no
 * matchea ninguna fila y devuelve 409.
 */
export type NcClaimResult =
  | { ok: true; claimTag: string; claimAt: string; release: () => Promise<void> }
  | { ok: false; status: number; body: unknown };

export async function claimNotaCredito(supabase: SupabaseLike, notaCreditoId: string): Promise<NcClaimResult> {
  const claimTag = `PENDING:${crypto.randomUUID()}`;
  const claimAt = new Date().toISOString();
  const { data: claimed, error: claimErr } = await supabase
    .from("factura_notas_credito")
    .update({ facturapi_id: claimTag, facturapi_claim_at: claimAt })
    .eq("id", notaCreditoId)
    .is("facturapi_id", null)
    .select("id")
    .maybeSingle();
  if (claimErr) return { ok: false, status: 500, body: { error: "claim_failed", detail: claimErr.message } };
  if (!claimed) {
    return { ok: false, status: 409, body: { error: "ya_timbrada", message: "Otro proceso ya está timbrando esta nota de crédito." } };
  }
  const release = async () => {
    await supabase
      .from("factura_notas_credito")
      .update({ facturapi_id: null, facturapi_claim_at: null })
      .eq("id", notaCreditoId)
      .eq("facturapi_id", claimTag);
  };
  return { ok: true, claimTag, claimAt, release };
}

export type PreloadResult =
  | { ok: true; nc: NcRow; factura: FacturaRow; cliente: ClienteRow; email: string | null; referencias: ReferenciasEmbarque }
  | { ok: false; status: number; body: unknown };

export async function preloadNcContext(
  supabase: SupabaseLike,
  notaCreditoId: string,
): Promise<PreloadResult> {
  const nc = await loadNc(supabase, notaCreditoId);
  if (!nc) return { ok: false, status: 404, body: { error: "nota_credito_not_found" } };
  if (nc.facturapi_id) return { ok: false, status: 409, body: { error: "ya_timbrada", message: "Esta nota de crédito ya fue timbrada." } };
  const factura = await loadFactura(supabase, nc.factura_id);
  if (!factura) return { ok: false, status: 404, body: { error: "factura_not_found" } };
  if (!factura.uuid_fiscal) return { ok: false, status: 409, body: { error: "factura_sin_uuid", message: "La factura original no tiene UUID fiscal. Timbra la factura primero." } };
  const cliente = await loadCliente(supabase, factura.cliente_id);
  if (!cliente) return { ok: false, status: 404, body: { error: "cliente_not_found" } };
  const email = await loadEmailPrincipal(supabase, factura.cliente_id);
  const referencias = await loadReferenciasEmbarque(supabase, factura);
  return { ok: true, nc, factura, cliente, email, referencias };
}

