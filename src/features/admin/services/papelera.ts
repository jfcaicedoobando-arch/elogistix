/**
 * Servicio de Papelera (soft-delete).
 * Wrappers de RPCs `list_trash`, `restore_record`, `purge_record`.
 *
 * Refactor 8.193.0: extraído de `pages/dashboard/Papelera.tsx` para no
 * llamar a Supabase directamente desde la capa de presentación
 * (auditoría arquitectónica P0.2).
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";

export type SoftTable =
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
  | "conceptos_venta";

export interface TrashRow {
  id: string;
  organization_id: string;
  deleted_at: string;
  deleted_by: string | null;
  deleted_by_email: string | null;
  label: string;
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

export async function restoreRecord(tabla: SoftTable, id: string): Promise<void> {
  const { error } = await supabase.rpc("restore_record", { _table: tabla, _id: id });
  if (error) throw error;
}

export async function purgeRecord(tabla: SoftTable, id: string): Promise<void> {
  const { error } = await supabase.rpc("purge_record", { _table: tabla, _id: id });
  if (error) throw error;
}
