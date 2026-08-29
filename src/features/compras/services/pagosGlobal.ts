/**
 * Listado global de pagos a proveedor (Ola E — /compras/pagos).
 *
 * Devuelve pagos con datos del proveedor y de la factura asociada,
 * filtrables por rango de fechas, proveedor y método de pago.
 *
 * A-9/M-4 (auditoría v14): `organizationId` se aplica explícito como
 * defensa en profundidad (la impersonación de super admin es client-side)
 * y `proveedorId`/`search` se resuelven server-side antes del `.limit()`
 * para no perder resultados en silencio.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { CAP_POSTGREST } from "@/constants/queryCaps";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import { resolverFacturaIdsPorBusqueda } from "./facturaSearchHelper";

export interface PagoProveedorRow {
  id: string;
  fecha_pago: string;
  monto: number;
  moneda: Tables<"pagos_proveedor">["moneda"];
  tipo_cambio_usd: number | null;
  metodo_pago: string;
  referencia: string | null;
  cuenta_bancaria_id: string | null;
  proveedor_factura_id: string;
  factura_folio_interno: string | null;
  factura_folio_proveedor: string | null;
  factura_total: number | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
}

export interface ListarPagosFiltros {
  desde?: string;
  hasta?: string;
  proveedorId?: string;
  metodoPago?: string;
  moneda?: "MXN" | "USD";
  search?: string;
}

export async function listarPagosProveedorGlobal(
  filtros: ListarPagosFiltros = {},
  organizationId?: string | null,
): Promise<PagoProveedorRow[]> {
  let q = supabase
    .from("pagos_proveedor")
    .select(
      `
      id, fecha_pago, monto, moneda, tipo_cambio_usd, metodo_pago, referencia,
      cuenta_bancaria_id, proveedor_factura_id,
      proveedor_facturas!inner(
        folio_interno, folio_proveedor, total, proveedor_id,
        proveedores(nombre)
      )
      `,
    )
    .is("deleted_at", null)
    .order("fecha_pago", { ascending: false })
    .limit(CAP_POSTGREST);

  if (organizationId) q = q.eq("organization_id", organizationId);
  if (filtros.desde) q = q.gte("fecha_pago", filtros.desde);
  if (filtros.hasta) q = q.lte("fecha_pago", filtros.hasta);
  if (filtros.metodoPago) q = q.eq("metodo_pago", filtros.metodoPago);
  if (filtros.moneda) q = q.eq("moneda", filtros.moneda);
  // Filtro por embebido: PostgREST soporta columnas de un `!inner` embebido
  // directamente como filtro de igualdad de la tabla raíz.
  if (filtros.proveedorId) q = q.eq("proveedor_facturas.proveedor_id", filtros.proveedorId);

  if (filtros.search) {
    const term = filtros.search.trim();
    const like = `%${term}%`;
    const ids = await resolverFacturaIdsPorBusqueda(term);
    q = ids.length > 0
      ? q.or(`referencia.ilike.${like},proveedor_factura_id.in.(${ids.join(",")})`)
      : q.ilike("referencia", like);
  }

  const { data, error } = await q;
  if (error) throw error;
  assertNotTruncated(data, CAP_POSTGREST, "compras.pagosGlobal");

  // SAFE-CAST: PostgREST devuelve la relación como objeto anidado.
  const raw = (data ?? []) as unknown as Array<{
    id: string;
    fecha_pago: string;
    monto: string | number;
    moneda: PagoProveedorRow["moneda"];
    tipo_cambio_usd: string | number | null;
    metodo_pago: string;
    referencia: string | null;
    cuenta_bancaria_id: string | null;
    proveedor_factura_id: string;
    proveedor_facturas: {
      folio_interno: string | null;
      folio_proveedor: string | null;
      total: string | number | null;
      proveedor_id: string | null;
      proveedores: { nombre: string | null } | null;
    } | null;
  }>;

  return raw.map((r) => ({
    id: r.id,
    fecha_pago: r.fecha_pago,
    monto: Number(r.monto ?? 0),
    moneda: r.moneda,
    tipo_cambio_usd: r.tipo_cambio_usd == null ? null : Number(r.tipo_cambio_usd),
    metodo_pago: r.metodo_pago,
    referencia: r.referencia,
    cuenta_bancaria_id: r.cuenta_bancaria_id,
    proveedor_factura_id: r.proveedor_factura_id,
    factura_folio_interno: r.proveedor_facturas?.folio_interno ?? null,
    factura_folio_proveedor: r.proveedor_facturas?.folio_proveedor ?? null,
    factura_total: r.proveedor_facturas?.total == null
      ? null
      : Number(r.proveedor_facturas.total),
    proveedor_id: r.proveedor_facturas?.proveedor_id ?? null,
    proveedor_nombre: r.proveedor_facturas?.proveedores?.nombre ?? null,
  }));
}
