/**
 * Servicio de proveedores: lectura paginada, detalle, mutaciones y operaciones
 * (conceptos de costo) vinculadas. Encapsula toda la I/O contra Supabase para
 * que los hooks solo se ocupen del estado de React Query.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";
import { fromDb } from "@/lib/supabase/cast";

type TipoProveedor = Enums<"tipo_proveedor">;

const PROVEEDOR_DETAIL_COLUMNS =
  "id, nombre, tipo, rfc, contacto, telefono, email, moneda_preferida, origen_proveedor, pais, organization_id, created_at, updated_at" as const;

export type Proveedor = Tables<"proveedores">;
export type ProveedorListItem = Pick<
  Proveedor,
  "id" | "nombre" | "tipo" | "rfc" | "contacto" | "moneda_preferida"
> & {
  total_operaciones: number;
  monto_pendiente: number;
};

export interface ProveedorOperacion {
  concepto: string;
  monto: number;
  moneda: string;
  estadoLiquidacion: string;
  fechaVencimiento: string | null;
  expediente: string;
  embarqueId: string;
  clienteNombre: string;
}

export interface FetchProveedoresParams {
  tipo: TipoProveedor;
  search: string;
  page: number;
  pageSize: number;
  organizationId: string | null;
}

export async function fetchProveedoresPaginados(
  params: FetchProveedoresParams,
): Promise<{ data: ProveedorListItem[]; count: number }> {
  const { tipo, search, page, pageSize, organizationId } = params;
  // Bloque 2.4 — RPC `proveedores_listado` con agregados (operaciones, pendiente).
  const offset = page * pageSize;
  const { data, error } = await supabase.rpc("proveedores_listado", {
    p_organization_id: organizationId ?? undefined,
    p_tipo: tipo,
    p_search: search || undefined,
    p_offset: offset,
    p_limit: pageSize,
  });
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    nombre: string;
    tipo: TipoProveedor;
    rfc: string | null;
    contacto: string | null;
    moneda_preferida: Proveedor["moneda_preferida"];
    pais: string | null;
    total_operaciones: number | string;
    monto_pendiente: number | string;
    total_count: number | string;
  }>;

  const count = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const mapped: ProveedorListItem[] = rows.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    tipo: r.tipo,
    rfc: r.rfc ?? "",
    contacto: r.contacto ?? "",
    moneda_preferida: r.moneda_preferida,
    total_operaciones: Number(r.total_operaciones),
    monto_pendiente: Number(r.monto_pendiente),
  }));
  return { data: mapped, count };
}

export async function fetchProveedor(id: string): Promise<Proveedor | null> {
  const { data, error } = await supabase
    .from("proveedores")
    .select(PROVEEDOR_DETAIL_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return fromDb<Proveedor | null>(data);
}

export async function insertProveedor(prov: TablesInsert<"proveedores">): Promise<Proveedor> {
  const { data, error } = await supabase.from("proveedores").insert(prov).select().single();
  if (error) throw error;
  return data;
}

export async function updateProveedor(
  id: string,
  changes: TablesUpdate<"proveedores">,
): Promise<void> {
  const { error } = await supabase.from("proveedores").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteProveedor(id: string): Promise<void> {
  const { error } = await supabase.from("proveedores").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProveedorOperaciones(
  proveedorId: string,
): Promise<ProveedorOperacion[]> {
  const { data, error } = await supabase
    .from("conceptos_costo")
    .select("*, embarques!conceptos_costo_embarque_id_fkey(expediente, id, cliente_nombre)")
    .eq("proveedor_id", proveedorId);
  if (error) throw error;

  return (data ?? []).map((row) => {
    type EmbarqueJoin = { expediente: string; id: string; cliente_nombre: string } | null;
    const embarque = fromDb<EmbarqueJoin>(row.embarques);
    return {
      concepto: row.concepto,
      monto: Number(row.monto),
      moneda: row.moneda,
      estadoLiquidacion: row.estado_liquidacion,
      fechaVencimiento: row.fecha_vencimiento,
      expediente: embarque?.expediente ?? "",
      embarqueId: embarque?.id ?? "",
      clienteNombre: embarque?.cliente_nombre ?? "",
    } satisfies ProveedorOperacion;
  });
}
