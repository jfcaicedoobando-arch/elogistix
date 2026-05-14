/**
 * Queries colaterales de un embarque: documentos, notas y facturas.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type DocumentoEmbarqueRow = Tables<"documentos_embarque">;
type NotaEmbarqueRow = Tables<"notas_embarque">;

export async function fetchEmbarqueDocumentos(embarqueId: string): Promise<DocumentoEmbarqueRow[]> {
  const { data, error } = await supabase
    .from("documentos_embarque")
    .select("id, embarque_id, nombre, archivo, estado, notas, organization_id, created_at")
    .eq("embarque_id", embarqueId);
  if (error) throw error;
  return (data ?? []) as DocumentoEmbarqueRow[];
}

export async function fetchEmbarqueNotas(embarqueId: string): Promise<NotaEmbarqueRow[]> {
  const { data, error } = await supabase
    .from("notas_embarque")
    .select("id, embarque_id, contenido, tipo, fecha, usuario, organization_id, created_at")
    .eq("embarque_id", embarqueId)
    .order("fecha", { ascending: false });
  if (error) throw error;
  return (data ?? []) as NotaEmbarqueRow[];
}

export async function fetchEmbarqueFacturas(embarqueId: string) {
  const { data, error } = await supabase
    .from("facturas")
    .select(
      "id, numero, embarque_id, expediente, cliente_id, cliente_nombre, estado, moneda, subtotal, iva, total, tipo_cambio, fecha_emision, fecha_vencimiento, referencia_bl, notas, organization_id, created_at, updated_at, proforma_id, factura_pdf_url, factura_xml_url",
    )
    .eq("embarque_id", embarqueId);
  if (error) throw error;
  return data ?? [];
}
