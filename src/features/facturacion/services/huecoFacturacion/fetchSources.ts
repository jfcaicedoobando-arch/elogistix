/**
 * Fuentes de datos (Supabase) para el "Hueco de Facturación". Solo I/O.
 *
 * v13.301.41 — Fase A auditoría: la fuente de verdad para "ya tiene CFDI vivo"
 * es `factura_embarques.activa = true` unido a un estado de factura vivo.
 * Se mantiene un fallback por `expediente` con filtro de estado para cubrir
 * facturas legacy sin bridge; una factura únicamente `Cancelada` deja de
 * ocultar al embarque del hueco (antes bastaba con `factura_pdf_url`).
 */
import { supabase } from "@/integrations/supabase/client";
import { FACTURA_ESTADOS_VIVOS_HUECO, HUECO_ETA_CORTE_ISO } from "./constants";

export interface EmbarqueHuecoRow {
  id: string;
  expediente: string | null;
  cliente_nombre: string | null;
  operador: string | null;
  etd: string | null;
  eta: string | null;
  bl_master: string | null;
  bl_house: string | null;
  tipo_cambio_usd: number | null;
  tipo_cambio_eur: number | null;
}

export interface ConceptoVentaDetalle {
  embarque_id: string;
  estado_facturacion: string | null;
  proforma_id: string | null;
  proforma_estado: string | null;
}

/**
 * v13.217.0 — Filtra por **ETA** (llegada) del contenedor. Devuelve embarques
 * con `eta` entre el corte del modelo nuevo (`2026-04-01`) y `limiteEtaIso`
 * (típicamente `hoy + 3 días`), para dar buffer al agente aduanal antes del
 * arribo real.
 */
export async function fetchEmbarquesParaHueco(
  organizationId: string | null,
  limiteEtaIso: string,
): Promise<EmbarqueHuecoRow[]> {
  let q = supabase
    .from("embarques")
    .select(
      "id, expediente, cliente_nombre, operador, etd, eta, bl_master, bl_house, tipo_cambio_usd, tipo_cambio_eur",
    )
    .is("deleted_at", null)
    .not("eta", "is", null)
    .gte("eta", HUECO_ETA_CORTE_ISO)
    .lte("eta", limiteEtaIso)
    .eq("facturado_historico", false)
    .order("eta", { ascending: true });

  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

/**
 * Trae conceptos_venta no borrados de los embarques dados, junto con el
 * `estado_proforma` de su proforma padre (si existe). Usado para detectar
 * cobertura por aceptación histórica.
 */
export async function fetchConceptosVentaDeEmbarques(
  ids: string[],
): Promise<ConceptoVentaDetalle[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("conceptos_venta")
    .select("embarque_id, estado_facturacion, proforma_id, proformas(estado_proforma, deleted_at)")
    .in("embarque_id", ids)
    .is("deleted_at", null);
  if (error) throw error;
  type Row = {
    embarque_id: string;
    estado_facturacion: string | null;
    proforma_id: string | null;
    proformas: { estado_proforma: string | null; deleted_at: string | null } | null;
  };
  // SAFE-CAST: Supabase infiere `proformas` como Json | null en el inner select;
  // el tipo `Row` describe la forma real de la respuesta y se valida por acceso a campos.
  const rows = (data ?? []) as unknown as Row[];
  return rows.map((r) => ({
    embarque_id: r.embarque_id,
    estado_facturacion: r.estado_facturacion,
    proforma_id: r.proforma_id,
    proforma_estado:
      r.proformas && !r.proformas.deleted_at ? r.proformas.estado_proforma : null,
  }));
}

/**
 * Devuelve el Set de `embarque_id` que tienen al menos una entrada en
 * `factura_embarques.activa = true` cuya factura tiene estado vivo. Ésta es
 * la fuente de verdad canónica desde v13.301.31.
 */
export async function fetchEmbarquesConFacturaViva(
  embarqueIds: string[],
  organizationId?: string | null,
): Promise<Set<string>> {
  if (embarqueIds.length === 0) return new Set();
  let q = supabase
    .from("factura_embarques")
    .select("embarque_id, facturas!inner(estado, cancellation_status)")
    .in("embarque_id", embarqueIds)
    .eq("activa", true)
    .in("facturas.estado", FACTURA_ESTADOS_VIVOS_HUECO);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  type Row = { embarque_id: string };
  // SAFE-CAST: Supabase infiere el join anidado, sólo leemos embarque_id.
  const rows = (data ?? []) as unknown as Row[];
  return new Set(rows.map((r) => r.embarque_id));
}

/**
 * Fallback legacy: expedientes con al menos una factura viva con PDF.
 * Sólo debe usarse para embarques sin bridge activo (facturas históricas
 * anteriores a `factura_embarques`).
 */
export async function fetchExpedientesConFacturaVivaLegacy(
  expedientes: string[],
  organizationId?: string | null,
): Promise<Set<string>> {
  if (expedientes.length === 0) return new Set();
  let q = supabase
    .from("facturas")
    .select("expediente")
    .in("expediente", expedientes)
    .in("estado", FACTURA_ESTADOS_VIVOS_HUECO)
    .not("factura_pdf_url", "is", null)
    .is("deleted_at", null);
  if (organizationId) q = q.eq("organization_id", organizationId);
  const { data, error } = await q;
  if (error) throw error;
  type Row = { expediente: string | null };
  // SAFE-CAST: proyección plana de una sola columna, filtrada abajo.
  const rows = (data ?? []) as unknown as Row[];
  const set = new Set<string>();
  for (const r of rows) if (r.expediente) set.add(r.expediente);
  return set;
}

export async function fetchVentasYFacturas(
  ids: string[],
  expedientes: string[],
  organizationId?: string | null,
) {
  const [ventasRes, expedientesFacturados, embarquesConBridge, conceptosDetalle] = await Promise.all([
    supabase
      .from("conceptos_venta")
      .select("embarque_id, total, moneda")
      .in("embarque_id", ids)
      .is("deleted_at", null),
    fetchExpedientesConFacturaVivaLegacy(expedientes, organizationId),
    fetchEmbarquesConFacturaViva(ids, organizationId),
    fetchConceptosVentaDeEmbarques(ids),
  ]);
  if (ventasRes.error) throw ventasRes.error;
  return {
    ventas: ventasRes.data ?? [],
    expedientesFacturados,
    embarquesConBridge,
    conceptosDetalle,
  };
}
