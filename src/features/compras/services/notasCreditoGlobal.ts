/**
 * Listado global de notas de crédito de proveedor (Ola E — /compras/notas-credito).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface NotaCreditoRow {
  id: string;
  folio_nc: string | null;
  fecha: string;
  monto: number;
  moneda: Tables<"proveedor_notas_credito">["moneda"];
  motivo: Tables<"proveedor_notas_credito">["motivo"];
  estado: Tables<"proveedor_notas_credito">["estado"];
  descripcion: string | null;
  proveedor_factura_id: string;
  factura_folio_interno: string | null;
  factura_folio_proveedor: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
}

export interface ListarNotasFiltros {
  desde?: string;
  hasta?: string;
  proveedorId?: string;
  estado?: NotaCreditoRow["estado"];
  moneda?: "MXN" | "USD";
  search?: string;
}

export async function listarNotasCreditoGlobal(
  filtros: ListarNotasFiltros = {},
): Promise<NotaCreditoRow[]> {
  let q = supabase
    .from("proveedor_notas_credito")
    .select(
      `
      id, folio_nc, fecha, monto, moneda, motivo, estado, descripcion,
      proveedor_factura_id,
      proveedor_facturas!inner(
        folio_interno, folio_proveedor, proveedor_id,
        proveedores(nombre)
      )
      `,
    )
    .is("deleted_at", null)
    .order("fecha", { ascending: false })
    .limit(1000);

  if (filtros.desde) q = q.gte("fecha", filtros.desde);
  if (filtros.hasta) q = q.lte("fecha", filtros.hasta);
  if (filtros.estado) q = q.eq("estado", filtros.estado);
  if (filtros.moneda) q = q.eq("moneda", filtros.moneda);

  const { data, error } = await q;
  if (error) throw error;

  // SAFE-CAST: relación anidada.
  const raw = (data ?? []) as unknown as Array<{
    id: string;
    folio_nc: string | null;
    fecha: string;
    monto: string | number;
    moneda: NotaCreditoRow["moneda"];
    motivo: NotaCreditoRow["motivo"];
    estado: NotaCreditoRow["estado"];
    descripcion: string | null;
    proveedor_factura_id: string;
    proveedor_facturas: {
      folio_interno: string | null;
      folio_proveedor: string | null;
      proveedor_id: string | null;
      proveedores: { nombre: string | null } | null;
    } | null;
  }>;

  let rows: NotaCreditoRow[] = raw.map((r) => ({
    id: r.id,
    folio_nc: r.folio_nc,
    fecha: r.fecha,
    monto: Number(r.monto ?? 0),
    moneda: r.moneda,
    motivo: r.motivo,
    estado: r.estado,
    descripcion: r.descripcion,
    proveedor_factura_id: r.proveedor_factura_id,
    factura_folio_interno: r.proveedor_facturas?.folio_interno ?? null,
    factura_folio_proveedor: r.proveedor_facturas?.folio_proveedor ?? null,
    proveedor_id: r.proveedor_facturas?.proveedor_id ?? null,
    proveedor_nombre: r.proveedor_facturas?.proveedores?.nombre ?? null,
  }));

  if (filtros.proveedorId) {
    rows = rows.filter((r) => r.proveedor_id === filtros.proveedorId);
  }
  if (filtros.search) {
    const s = filtros.search.trim().toLowerCase();
    rows = rows.filter((r) =>
      [r.folio_nc, r.factura_folio_interno, r.factura_folio_proveedor, r.proveedor_nombre, r.descripcion]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(s)),
    );
  }
  return rows;
}
