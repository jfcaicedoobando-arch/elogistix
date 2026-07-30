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
 * Busca la factura VIVA (no borrada) de la organización que ya registró un
 * UUID fiscal. Permite avisar del CFDI duplicado al cargar el XML, en vez de
 * esperar al choque del índice único durante el INSERT.
 */
export async function buscarFacturaPorUuidFiscal(
  uuidFiscal: string,
): Promise<FacturaExistentePorUuid | null> {
  const uuid = uuidFiscal.trim();
  if (!uuid) return null;
  const data = await unwrapOr(
    supabase
      .from("proveedor_facturas")
      .select("id, folio_interno, folio_proveedor, proveedor_nombre, estado, estado_aprobacion")
      .eq("uuid_fiscal", uuid)
      .is("deleted_at", null)
      .limit(1),
    [],
  );
  return data[0] ?? null;
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
