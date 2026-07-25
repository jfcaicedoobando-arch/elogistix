/**
 * Servicio del feature Anticipos a Proveedor (QW6 — UI).
 * Reutiliza los wrappers de RPC ya probados en `@/features/cxp/services/anticipos`
 * (nada de INSERT directo: las 3 RPCs fijan estado/seguridad en el servidor).
 * Añade únicamente las lecturas que la UI necesita (bandeja + detalle de factura).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";
import {
  registrarAnticipo,
  aplicarAnticipo,
  cancelarAnticipo,
  AnticipoError,
  type Anticipo,
  type AnticipoAplicacion,
  type RegistrarAnticipoInput,
  type MonedaAnticipo,
} from "@/features/cxp/services/anticipos";

export {
  registrarAnticipo,
  aplicarAnticipo,
  cancelarAnticipo,
  AnticipoError,
};
export type { Anticipo, AnticipoAplicacion, RegistrarAnticipoInput, MonedaAnticipo };

/** Fila de la bandeja de anticipos, con el nombre de proveedor ya resuelto. */
export type AnticipoConProveedor = Anticipo & { proveedor_nombre: string | null };

export interface AnticiposFiltro {
  estado?: string | null;
  proveedorId?: string | null;
}

const ANTICIPO_SELECT =
  "*, proveedores:proveedor_id ( nombre )" as const;

interface AnticipoRow extends Anticipo {
  proveedores: { nombre: string | null } | null;
}

export async function fetchAnticiposProveedor(
  filtros: AnticiposFiltro = {},
): Promise<AnticipoConProveedor[]> {
  let query = supabase
    .from("anticipos_proveedor")
    .select(ANTICIPO_SELECT)
    .is("deleted_at", null)
    .order("fecha_anticipo", { ascending: false });

  if (filtros.estado) query = query.eq("estado", filtros.estado);
  if (filtros.proveedorId) query = query.eq("proveedor_id", filtros.proveedorId);

  // SAFE-CAST: unwrapOr devuelve el shape crudo de Supabase con la relación
  // embebida `proveedores(nombre)`; el tipo generado no incluye esa join,
  // así que degradamos el cast — el mapper de la siguiente línea consume
  // exactamente esa forma.
  const rows = (await unwrapOr(query, [])) as unknown as AnticipoRow[];
  return rows.map((r) => ({ ...r, proveedor_nombre: r.proveedores?.nombre ?? null }));
}

/** Anticipos aplicados a una factura de proveedor (sección "Anticipos aplicados" en el detalle). */
export async function fetchAplicacionesPorFactura(
  facturaId: string,
): Promise<AnticipoAplicacion[]> {
  if (!facturaId) return [];
  return unwrapOr(
    supabase
      .from("anticipos_aplicaciones")
      .select("*")
      .eq("proveedor_factura_id", facturaId)
      .is("deleted_at", null)
      .order("fecha_aplicacion", { ascending: false }),
    [],
  );
}
