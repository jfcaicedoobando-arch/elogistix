/**
 * CRUD básico de facturas de proveedor. Separado de `proveedorFacturas.ts`
 * para respetar Power-of-10 (≤200 líneas por archivo).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import type { TablesInsert } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";
import { normalizarUuidFiscal } from "@/lib/domain/uuidFiscal";


// folio_interno se asigna en el trigger BEFORE INSERT de la BD; el caller no lo manda.
export type NuevaFacturaProveedorPayload =
  Omit<TablesInsert<"proveedor_facturas">, "folio_interno"> & { folio_interno?: string };

export async function crearFacturaProveedor(payload: NuevaFacturaProveedorPayload) {
  const data = await unwrap(
    supabase
      .from("proveedor_facturas")
      .insert(payload as TablesInsert<"proveedor_facturas">)
      .select()
      .single(),
  );
  await registrarActividad({
    modulo: "cxp",
    accion: "crear",
    entidadId: data.id,
    entidadNombre: data.folio_interno ?? data.folio_proveedor ?? "",
    detalles: {
      proveedor_id: data.proveedor_id,
      proveedor_nombre: data.proveedor_nombre,
      folio_proveedor: data.folio_proveedor,
      total: data.total,
      moneda: data.moneda,
    },
  });
  return data;
}

/**
 * Verifica si ya existe una factura con el mismo proveedor + folio + fecha emisión
 * (excluyendo canceladas y borradas). Bloquea capturas duplicadas accidentales.
 *
 * P1-2: la fecha forma parte de la llave; sin ella no hay duplicado que evaluar
 * (el schema del formulario ya la exige antes de llegar aquí).
 */
export async function existeFacturaDuplicada(
  proveedorId: string,
  folioProveedor: string,
  fechaEmision: string,
  excluirId?: string,
): Promise<boolean> {
  if (!fechaEmision) return false;
  let q = supabase
    .from("proveedor_facturas")
    .select("id")
    .eq("proveedor_id", proveedorId)
    .eq("folio_proveedor", folioProveedor.trim())
    .eq("fecha_emision", fechaEmision)
    .neq("estado", "Cancelada")
    .is("deleted_at", null)
    .limit(1);
  if (excluirId) q = q.neq("id", excluirId);
  const data = await unwrapOr(q, []);
  return data.length > 0;
}

/** Resumen mínimo de una factura viva que ya usa un UUID fiscal. */
export interface FacturaExistentePorUuid {
  id: string;
  folio_interno: string | null;
  folio_proveedor: string | null;
  proveedor_nombre: string | null;
  estado: string | null;
  estado_aprobacion: string | null;
}

/**
 * Resultado explícito: distinguir "no existe" de "no se pudo consultar" evita
 * que un fallo de red o de RLS se lea como "no hay duplicado" (v13.368.0).
 */
export type BusquedaUuidFiscal =
  | { estado: "ninguno" }
  | { estado: "existe"; factura: FacturaExistentePorUuid }
  | { estado: "error" };

/**
 * Busca la factura VIVA (no borrada) de la organización que ya registró un
 * UUID fiscal, ignorando mayúsculas/minúsculas igual que el índice único.
 * Si la lectura directa falla (RLS), reintenta con el RPC seguro.
 */
export async function buscarFacturaPorUuidFiscalResultado(
  uuidFiscal: string | null | undefined,
): Promise<BusquedaUuidFiscal> {
  const uuid = normalizarUuidFiscal(uuidFiscal);
  if (!uuid) return { estado: "ninguno" };
  const cols = "id, folio_interno, folio_proveedor, proveedor_nombre, estado, estado_aprobacion";
  const { data, error } = await supabase
    .from("proveedor_facturas")
    .select(cols)
    .ilike("uuid_fiscal", uuid)
    .is("deleted_at", null)
    .limit(1);
  if (!error) {
    return data && data.length > 0 ? { estado: "existe", factura: data[0] } : { estado: "ninguno" };
  }
  // SAFE-CAST: el RPC existe en BD; los tipos se regeneran tras la migración.
  const rpc = await supabase.rpc("buscar_factura_proveedor_por_uuid" as never, { p_uuid: uuid } as never);
  if (rpc.error) return { estado: "error" };
  const f = rpc.data as FacturaExistentePorUuid | null;
  return f ? { estado: "existe", factura: f } : { estado: "ninguno" };
}

/** Compatibilidad: `null` cuando no existe o no se pudo consultar. */
export async function buscarFacturaPorUuidFiscal(
  uuidFiscal: string,
): Promise<FacturaExistentePorUuid | null> {
  const r = await buscarFacturaPorUuidFiscalResultado(uuidFiscal);
  return r.estado === "existe" ? r.factura : null;
}


export async function softDeleteFacturaProveedor(id: string, userId: string | null) {
  await run(
    supabase
      // SAFE-CAST: los tipos se regeneran después de la migración; el RPC ya existe en BD.
      .rpc("soft_delete_proveedor_factura" as never, {
        p_factura_id: id,
        p_deleted_by: userId,
      } as never),
  );
  await registrarActividad({
    modulo: "cxp",
    accion: "eliminar",
    entidadId: id,
    detalles: { deleted_by: userId },
  });
}
