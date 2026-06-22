/**
 * Servicio de proveedores: lectura paginada, detalle y mutaciones.
 * Extraído de `index.ts` (Auditoría Paso 2: purga de barrels).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";
import { fromDb } from "@/lib/supabase/cast";
import { ProveedorDuplicadoError, findProveedorByRfcEnOrg } from "./duplicadoRfc";

type TipoProveedor = Enums<"tipo_proveedor">;
type CategoriaProveedor = Enums<"categoria_proveedor">;
type SubtipoGasto = Enums<"subtipo_gasto_operativo">;

const PROVEEDOR_DETAIL_COLUMNS =
  "id, nombre, tipo, rfc, contacto, telefono, email, moneda_preferida, origen_proveedor, pais, categoria, subtipo_gasto, organization_id, cp, direccion, ciudad, estado, regimen_fiscal, banco, clabe, banco_pais, swift_bic, iban, aba_routing, banco_direccion, banco_intermediario, banco_intermediario_swift, beneficiario, referencia_pago, created_at, updated_at" as const;

export type Proveedor = Tables<"proveedores">;
export type ProveedorListItem = Pick<
  Proveedor,
  "id" | "nombre" | "tipo" | "rfc" | "contacto" | "moneda_preferida"
> & {
  origen_proveedor: "Nacional" | "Extranjero" | null;
  categoria: CategoriaProveedor;
  subtipo_gasto: SubtipoGasto | null;
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
  tipo?: TipoProveedor | null;
  search: string;
  page: number;
  pageSize: number;
  organizationId: string | null;
  origen?: "Nacional" | "Extranjero" | "todos";
  categoria?: CategoriaProveedor | "todos";
  subtipoGasto?: SubtipoGasto | null;
}

export async function fetchProveedoresPaginados(
  params: FetchProveedoresParams,
): Promise<{ data: ProveedorListItem[]; count: number }> {
  const { tipo, search, page, pageSize, organizationId, origen, categoria, subtipoGasto } = params;
  const offset = page * pageSize;
  const { data, error } = await supabase.rpc("proveedores_listado", {
    p_organization_id: organizationId ?? undefined,
    p_tipo: tipo || undefined,
    p_search: search || undefined,
    p_offset: offset,
    p_limit: pageSize,
    p_origen: origen && origen !== "todos" ? origen : undefined,
    p_categoria: categoria && categoria !== "todos" ? categoria : undefined,
    p_subtipo_gasto: subtipoGasto || undefined,
    // SAFE-CAST: la firma del RPC tipado en Supabase aún no recoge los nuevos parámetros.
  } as unknown as Parameters<typeof supabase.rpc<"proveedores_listado">>[1]);
  if (error) throw error;

  const rows = (data ?? []) as Array<{
    id: string;
    nombre: string;
    tipo: TipoProveedor | null;
    rfc: string | null;
    contacto: string | null;
    moneda_preferida: Proveedor["moneda_preferida"];
    pais: string | null;
    origen_proveedor: "Nacional" | "Extranjero" | null;
    categoria: CategoriaProveedor;
    subtipo_gasto: SubtipoGasto | null;
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
    origen_proveedor: r.origen_proveedor ?? null,
    categoria: r.categoria,
    subtipo_gasto: r.subtipo_gasto ?? null,
    total_operaciones: Number(r.total_operaciones),
    monto_pendiente: Number(r.monto_pendiente),
  }));
  return { data: mapped, count };
}

export interface ProveedorLite { id: string; nombre: string }

export async function fetchProveedoresLite(organizationId?: string | null): Promise<ProveedorLite[]> {
  let query = supabase
    .from("proveedores")
    .select("id, nombre");
  if (organizationId) query = query.eq("organization_id", organizationId);

  const { data, error } = await query
    .order("nombre", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as ProveedorLite[];
}

export async function findProveedorByRfc(rfc: string): Promise<{ id: string; nombre: string } | null> {
  if (!rfc) return null;
  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .eq("rfc", rfc.trim().toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
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
  if (error) {
    // 23505 = unique_violation (índice proveedores_org_rfc_unique)
    if ((error as { code?: string }).code === "23505") {
      const existente = await findProveedorByRfcEnOrg(prov.rfc ?? "", prov.organization_id ?? null);
      throw new ProveedorDuplicadoError(existente, (prov.rfc ?? "").trim().toUpperCase());
    }
    throw error;
  }
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
