/**
 * Servicio: proformas aprobadas listas para convertir a factura.
 *
 * Una proforma está "lista para facturar" cuando:
 *   - `estado_revision = 'aprobada'` (aprobada internamente)
 *   - `factura_id IS NULL` (aún no se ha convertido a CFDI/borrador)
 *   - `deleted_at IS NULL` (no eliminada lógicamente)
 *
 * Sólo I/O — la orquestación vive en `hooks/useProformasListas.ts`.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FilaProformaLista {
  id: string;
  numero: string;
  cliente_nombre: string;
  expediente: string | null;
  total_usd: number | null;
  total_mxn: number | null;
  created_at: string;
}

export async function fetchProformasListas(orgId: string): Promise<FilaProformaLista[]> {
  const { data, error } = await supabase
    .from("proformas")
    .select("id, numero, cliente_nombre, expediente, total_usd, total_mxn, created_at")
    .eq("organization_id", orgId)
    .eq("estado_revision", "aprobada")
    .is("factura_id", null)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as FilaProformaLista[];
}

export async function fetchProformasListasCount(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from("proformas")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("estado_revision", "aprobada")
    .is("factura_id", null)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}
