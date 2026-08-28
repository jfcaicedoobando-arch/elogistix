/**
 * Servicio del feature Anticipos a Proveedor (QW6 — UI).
 * Reutiliza los wrappers de RPC ya probados en `@/features/cxp/services/anticipos`
 * (nada de INSERT directo: las RPCs fijan estado/seguridad en el servidor).
 * Añade únicamente las lecturas que la UI necesita (bandeja + detalle de factura
 * + anticipos ligados a un embarque).
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";
import {
  registrarAnticipo,
  aplicarAnticipo,
  cancelarAnticipo,
  devolverAnticipo,
  vincularAnticipoEmbarque,
  type Anticipo,
  type AnticipoAplicacion,
  type RegistrarAnticipoInput,
  type DevolverAnticipoInput,
} from "@/features/cxp/services";

export {
  registrarAnticipo,
  aplicarAnticipo,
  cancelarAnticipo,
  devolverAnticipo,
  vincularAnticipoEmbarque,
};
export type { Anticipo, AnticipoAplicacion, RegistrarAnticipoInput, DevolverAnticipoInput };

/** Fila de la bandeja de anticipos, con proveedor y expediente ya resueltos. */
export type AnticipoConProveedor = Anticipo & {
  proveedor_nombre: string | null;
  embarque_expediente: string | null;
};

export interface AnticiposFiltro {
  estado?: string | null;
  proveedorId?: string | null;
  embarqueId?: string | null;
  /** Sólo anticipos que quedaron sin expediente vinculado. */
  sinEmbarque?: boolean;
}

const ANTICIPO_SELECT =
  "*, proveedores:proveedor_id ( nombre ), embarques:embarque_id ( expediente )" as const;

interface AnticipoRow extends Anticipo {
  proveedores: { nombre: string | null } | null;
  embarques: { expediente: string | null } | null;
}

function mapRow(r: AnticipoRow): AnticipoConProveedor {
  return {
    ...r,
    proveedor_nombre: r.proveedores?.nombre ?? null,
    embarque_expediente: r.embarques?.expediente ?? null,
  };
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
  if (filtros.embarqueId) query = query.eq("embarque_id", filtros.embarqueId);
  if (filtros.sinEmbarque) query = query.is("embarque_id", null);

  // SAFE-CAST: unwrapOr devuelve el shape crudo de Supabase con las relaciones
  // embebidas `proveedores(nombre)` y `embarques(expediente)`; el tipo generado
  // no incluye esas joins, así que degradamos el cast — el mapper de la
  // siguiente línea consume exactamente esa forma.
  const rows = (await unwrapOr(query, [])) as unknown as AnticipoRow[];
  return rows.map(mapRow);
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

/** Anticipos con saldo a favor de un proveedor (disponible o aplicado parcial). */
export async function fetchAnticiposDisponibles(
  proveedorId: string,
): Promise<AnticipoConProveedor[]> {
  if (!proveedorId) return [];
  const query = supabase
    .from("anticipos_proveedor")
    .select(ANTICIPO_SELECT)
    .eq("proveedor_id", proveedorId)
    .in("estado", ["disponible", "aplicado_parcial"])
    .gt("saldo_disponible", 0)
    .is("deleted_at", null)
    .order("fecha_anticipo", { ascending: true });

  // SAFE-CAST: mismas joins embebidas que `fetchAnticiposProveedor`.
  const rows = (await unwrapOr(query, [])) as unknown as AnticipoRow[];
  return rows.map(mapRow);
}

/** Anticipos ligados a un embarque (tarjeta en la pestaña Costos del embarque). */
export async function fetchAnticiposPorEmbarque(
  embarqueId: string,
): Promise<AnticipoConProveedor[]> {
  if (!embarqueId) return [];
  const query = supabase
    .from("anticipos_proveedor")
    .select(ANTICIPO_SELECT)
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null)
    .order("fecha_anticipo", { ascending: false });

  // SAFE-CAST: mismas joins embebidas que `fetchAnticiposProveedor`.
  const rows = (await unwrapOr(query, [])) as unknown as AnticipoRow[];
  return rows.map(mapRow);
}

/** Monto aplicado de cada anticipo a facturas del mismo embarque. */
export async function fetchAplicadoEnEmbarque(
  embarqueId: string,
): Promise<Record<string, number>> {
  if (!embarqueId) return {};
  const query = supabase
    .from("anticipos_aplicaciones")
    .select("anticipo_id, monto_aplicado, proveedor_facturas:proveedor_factura_id ( embarque_id )")
    .is("deleted_at", null);

  // SAFE-CAST: la relación embebida `proveedor_facturas(embarque_id)` no está
  // en los tipos generados; el reduce siguiente consume exactamente esta forma.
  const rows = (await unwrapOr(query, [])) as unknown as Array<{
    anticipo_id: string;
    monto_aplicado: number;
    proveedor_facturas: { embarque_id: string | null } | null;
  }>;

  return rows.reduce<Record<string, number>>((acc, r) => {
    if (r.proveedor_facturas?.embarque_id !== embarqueId) return acc;
    acc[r.anticipo_id] = (acc[r.anticipo_id] ?? 0) + Number(r.monto_aplicado);
    return acc;
  }, {});
}
