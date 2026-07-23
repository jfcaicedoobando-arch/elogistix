/**
 * Servicio: proformas aceptadas por el cliente y listas para convertir a factura.
 *
 * Una proforma está "lista para facturar" cuando su `getEstadoUnificado`
 * (ver `@/lib/domain/estadoUnificado`) resuelve a `'aceptada'`:
 *   - `estado_cliente = 'aceptada'` (el cliente aceptó la proforma)
 *   - `estado_proforma <> 'facturada'` (aún no cerrada en flujo legacy)
 *   - `factura_id IS NULL` (sin CFDI/borrador enlazado)
 *   - `deleted_at IS NULL` (no eliminada lógicamente)
 *
 * Nota: `estado_revision` es aprobación INTERNA (previo a mandar al cliente)
 * y NO forma parte del gate de facturación. Filtrar por él dejaba pasar
 * ~22 filas legacy con `estado_proforma='facturada' AND factura_id IS NULL`
 * (CFDI emitido fuera del sistema) que inflaban el contador.
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
    .eq("estado_cliente", "aceptada")
    .neq("estado_proforma", "facturada")
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
    .eq("estado_cliente", "aceptada")
    .neq("estado_proforma", "facturada")
    .is("factura_id", null)
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}
