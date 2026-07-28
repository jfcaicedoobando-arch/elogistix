/**
 * B-030 — Fetch directo de facturas programables para la bandeja semanal de
 * Tesorería. Antes la vista usaba la RPC `cxp_por_pagar`, que filtra
 * `estado = 'Vigente'` y dejaba fuera facturas en captura / por aprobar con
 * fecha programada (filtro implícito: la bandeja mostraba "2 de N").
 * Aquí se listan TODAS las facturas no canceladas con saldo > 0 y el filtro
 * queda explícito en la UI.
 */
import { supabase } from "@/integrations/supabase/client";
import { unwrapOr } from "@/lib/supabase/response";
import type { FacturaProgramable } from "@/features/tesoreria/domain/pagosProgramados";

export interface FacturaProgramableRow extends FacturaProgramable {
  estado: string;
  estado_aprobacion: string;
}

interface RowCruda {
  id: string;
  proveedor_nombre: string | null;
  folio_proveedor: string | null;
  fecha_vencimiento: string | null;
  fecha_programada_pago: string | null;
  moneda: string;
  total: number;
  estado: string;
  estado_aprobacion: string;
  pagos_proveedor: Array<{ monto: number; deleted_at: string | null }> | null;
}

export async function fetchPagosProgramables(): Promise<FacturaProgramableRow[]> {
  const rows = (await unwrapOr(
    supabase
      .from("proveedor_facturas")
      .select("id, proveedor_nombre, folio_proveedor, fecha_vencimiento, fecha_programada_pago, moneda, total, estado, estado_aprobacion, pagos_proveedor(monto, deleted_at)")
      .is("deleted_at", null)
      .neq("estado", "Cancelada")
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
      .limit(1000),
    [] as RowCruda[],
  )) as unknown as RowCruda[];

  return rows
    .map((r) => {
      const pagado = (r.pagos_proveedor ?? []).filter((p) => !p.deleted_at).reduce((s, p) => s + Number(p.monto), 0);
      const saldo = Math.max(0, Number(r.total) - pagado);
      return {
        id: r.id,
        proveedor_nombre: r.proveedor_nombre,
        folio_proveedor: r.folio_proveedor,
        fecha_vencimiento: r.fecha_vencimiento,
        fecha_programada_pago: r.fecha_programada_pago,
        moneda: r.moneda,
        total: Number(r.total),
        saldo,
        estado: r.estado,
        estado_aprobacion: r.estado_aprobacion,
      } as FacturaProgramableRow;
    })
    .filter((r) => r.saldo > 0.005);
}
