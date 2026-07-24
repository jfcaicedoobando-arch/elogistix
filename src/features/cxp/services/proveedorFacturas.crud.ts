/**
 * CRUD básico de facturas de proveedor. Separado de `proveedorFacturas.ts`
 * para respetar Power-of-10 (≤200 líneas por archivo).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr, run } from "@/lib/supabase/response";
import type { TablesInsert } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";

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
 */
export async function existeFacturaDuplicada(
  proveedorId: string,
  folioProveedor: string,
  fechaEmision: string,
  excluirId?: string,
): Promise<boolean> {
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
