/**
 * Servicio de proveedores: lectura paginada, detalle y mutaciones.
 * Extraído de `index.ts` (Auditoría Paso 2: purga de barrels).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate, Enums } from "@/integrations/supabase/types";
import { fromDb } from "@/lib/supabase/cast";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import { normalizarRazonSocial } from "@/lib/text/razonSocial";
import { ProveedorDuplicadoError, findProveedorByRfcEnOrg } from "./duplicadoRfc";
import { bitacoraProveedor } from "./proveedoresBitacora";
import { CAP_LISTA } from "@/constants/queryCaps";
import { conflictoConcurrenciaError } from "@/lib/errors/concurrencia";

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
  categoria: CategoriaProveedor | null;
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
}

export async function fetchProveedoresPaginados(
  params: FetchProveedoresParams,
): Promise<{ data: ProveedorListItem[]; count: number }> {
  const { tipo, search, page, pageSize, organizationId, origen } = params;
  const offset = page * pageSize;
  const { data, error } = await supabase.rpc("proveedores_listado", {
    p_organization_id: organizationId ?? undefined,
    p_tipo: tipo || undefined,
    p_search: search || undefined,
    p_offset: offset,
    p_limit: pageSize,
    p_origen: origen && origen !== "todos" ? origen : undefined,
  });

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
    categoria: CategoriaProveedor | null;
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

export interface ProveedorLite { id: string; nombre: string; dias_credito: number }

export async function fetchProveedoresLite(organizationId?: string | null): Promise<ProveedorLite[]> {
  // v13.315.8 (QW2) — incluimos `dias_credito` para prellenar el vencimiento
  // al capturar facturas de proveedor.
  let query = supabase.from("proveedores").select("id, nombre, dias_credito");
  if (organizationId) query = query.eq("organization_id", organizationId);
  query = query.is("deleted_at", null);
  return unwrapOr(query.order("nombre", { ascending: true }).limit(CAP_LISTA), []) as Promise<ProveedorLite[]>;
}

export async function findProveedorByRfc(rfc: string): Promise<{ id: string; nombre: string } | null> {
  if (!rfc) return null;
  return unwrap(
    supabase
      .from("proveedores")
      .select("id, nombre")
      .eq("rfc", rfc.trim().toUpperCase())
      .is("deleted_at", null)
      .maybeSingle(),
  ) as Promise<{ id: string; nombre: string } | null>;
}

export async function fetchProveedor(id: string): Promise<Proveedor | null> {
  const data = await unwrap(
    supabase
      .from("proveedores")
      .select(PROVEEDOR_DETAIL_COLUMNS)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle(),
  );
  return fromDb<Proveedor | null>(data);
}

export async function insertProveedor(prov: TablesInsert<"proveedores">): Promise<Proveedor> {
  const payload = { ...prov, nombre: normalizarRazonSocial(prov.nombre) };
  const { data, error } = await supabase.from("proveedores").insert(payload).select().single();
  if (error) {
    // 23505 = unique_violation (índice proveedores_org_rfc_unique)
    if ((error as { code?: string }).code === "23505") {
      const existente = await findProveedorByRfcEnOrg(prov.rfc ?? "", prov.organization_id ?? null);
      throw new ProveedorDuplicadoError(existente, (prov.rfc ?? "").trim().toUpperCase());
    }
    throw error;
  }
  await bitacoraProveedor("crear", data.id, data.nombre, {
    rfc: data.rfc,
    tipo: data.tipo,
  });
  return data;
}

export async function updateProveedor(
  id: string,
  changes: TablesUpdate<"proveedores">,
  /**
   * Bloqueo optimista (mismo patrón que `cliente/services/crud.ts`):
   * `updated_at` leído al abrir el formulario. Si la fila ya cambió, el
   * UPDATE no toca ninguna fila y se lanza LC_CONFLICTO_CONCURRENCIA en vez
   * de sobrescribir cambios ajenos (last-write-wins).
   */
  expectedUpdatedAt?: string | null,
  organizationId?: string | null,
): Promise<void> {
  // P2-1 (R5): un UPDATE bloqueado por RLS o sobre un id inexistente NO devuelve
  // error en PostgREST — devuelve 0 filas. Sin este chequeo la UI mostraba
  // "Proveedor actualizado" y nada se había guardado.
  const payload =
    changes.nombre === undefined
      ? changes
      : { ...changes, nombre: normalizarRazonSocial(changes.nombre) };
  let query = supabase.from("proveedores").update(payload).eq("id", id);
  if (organizationId) query = query.eq("organization_id", organizationId);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const data = await unwrap(query.select("id").maybeSingle());
  if (!data) {
    if (expectedUpdatedAt) throw conflictoConcurrenciaError();
    throw new Error("No se guardaron los cambios del proveedor: no tienes permiso o el proveedor ya no existe.");
  }
  await bitacoraProveedor("editar", id, typeof payload.nombre === "string" ? payload.nombre : "", {
    campos: Object.keys(payload),
  });
}

export async function deleteProveedor(id: string, userId: string | null = null): Promise<void> {
  // M6: soft-delete. El índice proveedores_org_rfc_unique es parcial
  // (deleted_at IS NULL): re-capturar el mismo RFC tras borrar ya no colisiona.
  await run(
    supabase
      .from("proveedores")
      .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
      .eq("id", id),
  );
  await bitacoraProveedor("eliminar", id, "", { deleted_by: userId });
}
