import { supabase } from "@/integrations/supabase/client";
import { PagoRequiereAprobacionError } from "./pagosProveedor";

export interface EstadoFacturaLote {
  id: string;
  proveedor_id: string | null;
  moneda: string;
  estado_aprobacion: string;
}

/** Lectura acotada al tenant; nunca cambia aprobaciones ni reemplaza guards SQL. */
export async function consultarEstadoFacturasLote(ids: string[], organizationId: string): Promise<EstadoFacturaLote[]> {
  if (!organizationId) throw new Error("LC_ORG_REQUERIDA");
  if (!ids.length) return [];
  const { data, error } = await supabase.from("proveedor_facturas")
    .select("id, proveedor_id, moneda, estado_aprobacion")
    .eq("organization_id", organizationId).in("id", [...new Set(ids)])
    .is("deleted_at", null);
  if (error) throw error;
  return data ?? [];
}

export function errorEstadoFacturasLote(ids: string[], estados: EstadoFacturaLote[], proveedorId: string, moneda: string) {
  if (ids.some((id) => !estados.some((f) => f.id === id))) {
    return "Una factura ya no está disponible en esta organización. Actualiza la selección.";
  }
  if (estados.some((f) => f.proveedor_id !== proveedorId || f.moneda !== moneda)) {
    return "El proveedor o la moneda de una factura cambió. Actualiza la selección.";
  }
  if (estados.some((f) => f.estado_aprobacion !== "aprobada")) {
    return "Todas las facturas del lote deben estar aprobadas antes de registrar pagos.";
  }
  return null;
}

/** Revalida justo antes de enviar, incluso si cambió la aprobación tras abrir. */
export async function verificarAprobacionLote(ids: string[], proveedorId: string, moneda: string) {
  const { data: organizationId, error } = await supabase.rpc("current_user_org_id");
  if (error) throw error;
  if (!organizationId) throw new Error("LC_ORG_REQUERIDA");
  const estados = await consultarEstadoFacturasLote(ids, organizationId);
  const mensaje = errorEstadoFacturasLote(ids, estados, proveedorId, moneda);
  if (mensaje) throw new PagoRequiereAprobacionError(mensaje);
}
