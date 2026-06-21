import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
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

export type ProformaDetalleFull = ProformaConFactura & {
  facturas_full: {
    id: string;
    numero: string;
    estado: string;
    total: number;
    moneda: string;
    fecha_emision: string | null;
    uuid_fiscal: string | null;
    factura_pdf_url: string | null;
    factura_xml_url: string | null;
  } | null;
};

export async function fetchProformaPorId(id: string): Promise<ProformaDetalleFull | null> {
  const { data, error } = await supabase
    .from("proformas")
    .select(
      "*, facturas:factura_id(factura_pdf_url, factura_xml_url), facturas_full:factura_id(id, numero, estado, total, moneda, fecha_emision, uuid_fiscal, factura_pdf_url, factura_xml_url)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return fromDb<ProformaDetalleFull>(data);
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
