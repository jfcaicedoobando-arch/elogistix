import { supabase } from "@/integrations/supabase/client";
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
  return (data ?? []) as unknown as ProformaConFactura[];
}

export async function fetchProformasAprobadas(organizationId: string): Promise<ProformaConFactura[]> {
  const { data, error } = await supabase
    .from("proformas")
    .select("*, facturas:factura_id(factura_pdf_url, factura_xml_url)")
    .eq("organization_id", organizationId)
    .eq("estado_revision", "aprobada")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProformaConFactura[];
}

export async function fetchProformasPendientes(
  organizationId: string,
): Promise<ProformaPendienteConEmbarque[]> {
  const { data, error } = await supabase
    .from("proformas")
    .select(
      "*, embarques:embarque_id(expediente, bl_master, cliente_nombre, contenedor, tipo_contenedor)",
    )
    .eq("organization_id", organizationId)
    .eq("estado_revision", "pendiente")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProformaPendienteConEmbarque[];
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

export { fetchDiasCreditoCliente } from "@/services/cliente";

export async function fetchEmbarqueParaPdf(embarqueId: string) {
  const { data, error } = await supabase
    .from("embarques")
    .select(
      "expediente, bl_master, modo, tipo, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, naviera, aerolinea, descripcion_mercancia",
    )
    .eq("id", embarqueId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchConceptosProforma(proformaId: string): Promise<ConceptoVentaRow[]> {
  const { data, error } = await supabase
    .from("conceptos_venta")
    .select("*")
    .eq("proforma_id", proformaId);
  if (error) throw error;
  return data ?? [];
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
