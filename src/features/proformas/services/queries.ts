import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { mergeProformaDetalle } from "./queries.helpers";
import type {
  ConceptoVentaRow,
  ProformaConFactura,
  ProformaConceptoConsolidadoRow,
  ProformaPendienteConEmbarque,
} from "./types";

export async function fetchProformasEmbarque(embarqueId: string): Promise<ProformaConFactura[]> {
  const { data, error } = await supabase
    .from("proformas")
    .select("*, facturas:factura_id(factura_pdf_url, factura_xml_url)")
    .eq("embarque_id", embarqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return fromDb<ProformaConFactura[]>(data ?? []);
}

export type ProformaClienteFull = {
  nombre: string | null;
  rfc: string | null;
  direccion: string | null;
  ciudad: string | null;
  estado: string | null;
  cp: string | null;
};

export type ProformaEmbarqueFull = {
  modo: string | null;
  tipo: string | null;
  incoterm: string | null;
  bl_house: string | null;
  puerto_origen: string | null;
  puerto_destino: string | null;
  aeropuerto_origen: string | null;
  aeropuerto_destino: string | null;
  ciudad_origen: string | null;
  ciudad_destino: string | null;
  descripcion_mercancia: string | null;
  contenedores: Array<{ numero_contenedor: string; tipo_contenedor: string | null }> | null;
};

export type ProformaFacturaAsociada = {
  id: string;
  numero: string | null;
  estado: string;
  total: number;
  moneda: string;
  fecha_emision: string | null;
  uuid_fiscal: string | null;
  factura_pdf_url: string | null;
  factura_xml_url: string | null;
};

export type ProformaDetalleFull = ProformaConFactura & {
  /**
   * Factura(s) generadas a partir de esta proforma. Se resuelve vía la FK
   * inversa `facturas.proforma_id → proformas.id` porque el flujo de
   * conversión "un clic" puede producir varias facturas (una por moneda —
   * el SAT no permite CFDI multi-moneda) y ya no llena `proformas.factura_id`.
   */
  facturas_asociadas: ProformaFacturaAsociada[];
  cliente_full: ProformaClienteFull | null;
  embarque_full: ProformaEmbarqueFull | null;
};

export async function fetchProformaPorId(id: string): Promise<ProformaDetalleFull | null> {
  const { data, error } = await supabase
    .from("proformas")
    .select(
      [
        "*",
        "facturas:factura_id(factura_pdf_url, factura_xml_url)",
        "facturas_asociadas:facturas!proforma_id(id, numero, estado, total, moneda, fecha_emision, uuid_fiscal, factura_pdf_url, factura_xml_url, deleted_at, created_at)",
        "cliente_full:cliente_id(nombre, rfc, direccion, ciudad, estado, cp)",
        "embarque_full:embarque_id(modo, tipo, incoterm, bl_house, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, descripcion_mercancia, contenedores:embarque_contenedores(numero_contenedor, tipo_contenedor))",
      ].join(", "),
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  // Filtrar facturas eliminadas lógicamente y ordenar por fecha de creación.
  type RawAsociada = ProformaFacturaAsociada & { deleted_at: string | null; created_at: string };
  const raw = data as unknown as {
    facturas_asociadas?: RawAsociada[] | null;
  } & Record<string, unknown>;
  const asociadas = (raw.facturas_asociadas ?? [])
    .filter((f) => !f.deleted_at)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(({ deleted_at: _d, created_at: _c, ...rest }) => rest);
  const merged = { ...(data as unknown as Record<string, unknown>), facturas_asociadas: asociadas };
  return fromDb<ProformaDetalleFull>(merged);
}




export async function fetchProformasAprobadas(organizationId: string): Promise<ProformaConFactura[]> {
  const { data, error } = await supabase
    .from("proformas")
    .select("*, facturas:factura_id(factura_pdf_url, factura_xml_url)")
    .eq("organization_id", organizationId)
    .eq("estado_revision", "aprobada")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return fromDb<ProformaConFactura[]>(data ?? []);
}

/**
 * Trae TODAS las proformas de la organización (pendientes, aprobadas y
 * facturadas). Usado por el listado unificado `/proformas` donde el usuario
 * filtra por estado en la UI. No filtra por `estado_revision`.
 */
export async function fetchProformasTodas(organizationId: string): Promise<ProformaConFactura[]> {
  const { data, error } = await supabase
    .from("proformas")
    .select("*, facturas:factura_id(factura_pdf_url, factura_xml_url)")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return fromDb<ProformaConFactura[]>(data ?? []);
}

export async function fetchProformasPendientes(
  organizationId: string,
): Promise<ProformaPendienteConEmbarque[]> {
  // Trae también los conceptos_venta con su contenedor hijo asignado, para que el
  // agrupador en cliente pueda separar correctamente proformas de embarques con
  // múltiples contenedores (modelo 1↔N v12.10).
  const { data, error } = await supabase
    .from("proformas")
    .select(
      "*, embarques:embarque_id(expediente, bl_master, cliente_nombre, contenedor, tipo_contenedor), conceptos_venta(contenedor_id, embarque_contenedores:contenedor_id(numero_contenedor, tipo_contenedor))",
    )
    .eq("organization_id", organizationId)
    .eq("estado_revision", "pendiente")
    .neq("estado_proforma", "facturada")
    .is("factura_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;

  // Derivar `contenedores_lista` (única por numero_contenedor) por proforma.
  type RawProforma = ProformaPendienteConEmbarque & {
    conceptos_venta?: Array<{
      contenedor_id: string | null;
      embarque_contenedores: { numero_contenedor: string; tipo_contenedor: string } | null;
    }> | null;
  };
  const enriched = (data ?? []).map((p) => {
    const raw = p as RawProforma;
    const seen = new Set<string>();
    const lista: { numero: string | null; tipo: string | null }[] = [];
    for (const cv of raw.conceptos_venta ?? []) {
      const numero = cv.embarque_contenedores?.numero_contenedor?.trim() || null;
      const tipo = cv.embarque_contenedores?.tipo_contenedor?.trim() || null;
      const key = numero ?? "__sin__";
      if (seen.has(key)) continue;
      seen.add(key);
      lista.push({ numero, tipo });
    }
    return { ...raw, contenedores_lista: lista } as ProformaPendienteConEmbarque;
  });
  return fromDb<ProformaPendienteConEmbarque[]>(enriched);
}

export async function fetchClienteParaPdf(clienteId: string) {
  const { data, error } = await supabase
    .from("clientes")
    .select("nombre, rfc, direccion, ciudad, estado, cp")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw error;
  return data;
}



export async function fetchEmbarqueParaPdf(embarqueId: string) {
  const { data, error } = await supabase
    .from("embarques")
    .select(
      "expediente, bl_master, bl_house, modo, tipo, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, naviera, aerolinea, descripcion_mercancia, contenedores:embarque_contenedores(id, numero_contenedor, tipo_contenedor)",
    )
    .eq("id", embarqueId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchConceptosProforma(proformaId: string): Promise<ConceptoVentaRow[]> {
  // B-4: incluir info del contenedor real (vía FK conceptos_venta.contenedor_id → embarque_contenedores)
  // para que el PDF agrupe por contenedor cuando el embarque es multi-contenedor.
  const { data, error } = await supabase
    .from("conceptos_venta")
    .select("*, embarque_contenedores:contenedor_id(id, numero_contenedor, tipo_contenedor)")
    .eq("proforma_id", proformaId);
  if (error) throw error;
  return fromDb<ConceptoVentaRow[]>(data ?? []);
}

export async function fetchConceptosConsolidados(
  proformaId: string,
): Promise<ProformaConceptoConsolidadoRow[]> {
  const { data, error } = await supabase
    .from("proforma_conceptos_consolidados")
    .select("*")
    .eq("proforma_id", proformaId);
  if (error) throw error;
  return data ?? [];
}
