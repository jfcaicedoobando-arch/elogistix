/**
 * Servicio de Papelera (soft-delete).
 * Wrappers de RPCs `list_trash`, `list_trash_counts`, `restore_record`, `purge_record`.
 *
 * v13.290.0 (Papelera Fase 2-4): allowlist ampliada a 29 tablas + contadores
 * por tabla para el UI (`listTrashCounts`). El servicio queda como única
 * superficie permitida para llamar los RPCs de papelera desde el frontend.
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

export type SoftTable =
  // Núcleo
  | "clientes"
  | "contactos_cliente"
  | "embarques"
  | "documentos_embarque"
  | "eventos_embarque"
  | "notas_embarque"
  | "cotizaciones"
  | "cotizacion_costos"
  | "facturas"
  | "conceptos_factura"
  | "proformas"
  | "proforma_conceptos_consolidados"
  | "conceptos_costo"
  | "conceptos_venta"
  // CRM
  | "crm_leads"
  | "crm_oportunidades"
  | "crm_actividades"
  | "crm_comentarios_oportunidad"
  | "crm_etapas_pipeline"
  | "crm_motivos_perdida"
  | "crm_plantillas_mensaje"
  // Finanzas
  | "pagos_factura"
  | "pagos_proveedor"
  | "proveedor_facturas"
  | "proveedor_notas_credito"
  | "factura_notas_credito"
  | "cuentas_bancarias"
  // Operaciones
  | "seguros_embarque"
  | "embarque_contenedores";

export interface TrashRow {
  id: string;
  organization_id: string;
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_email: string | null;
  label: string;
}

export interface TrashCountRow {
  tabla: SoftTable;
  total: number;
}

export async function listTrash(tabla: SoftTable, limit = 200, offset = 0): Promise<TrashRow[]> {
  const { data, error } = await supabase.rpc("list_trash", {
    _table: tabla,
    _limit: limit,
    _offset: offset,
  });
  if (error) throw error;
  return fromDb<TrashRow[]>(data ?? []);
}

export async function listTrashCounts(): Promise<TrashCountRow[]> {
  const { data, error } = await supabase.rpc("list_trash_counts");
  if (error) throw error;
  return fromDb<TrashCountRow[]>(data ?? []);
}

export async function restoreRecord(tabla: SoftTable, id: string): Promise<void> {
  const { error } = await supabase.rpc("restore_record", { _table: tabla, _id: id });
  if (error) throw error;
}

export async function purgeRecord(tabla: SoftTable, id: string): Promise<void> {
  const { error } = await supabase.rpc("purge_record", { _table: tabla, _id: id });
  if (error) throw error;
}
