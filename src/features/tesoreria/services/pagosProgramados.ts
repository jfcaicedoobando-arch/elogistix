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
import {
  sumarPagosEnMonedaFactura,
  sumarNotasCreditoAplicadas,
  type PagoCxpParcial,
  type NotaCreditoCxpParcial,
} from "@/features/cxp/services";
import { CAP_POSTGREST } from "@/constants/queryCaps";

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
  pagos_proveedor: Array<PagoCxpParcial> | null;
  proveedor_notas_credito: Array<NotaCreditoCxpParcial> | null;
}

export async function fetchPagosProgramables(): Promise<FacturaProgramableRow[]> {
  const rows = (await unwrapOr(
    supabase
      .from("proveedor_facturas")
      .select("id, proveedor_nombre, folio_proveedor, fecha_vencimiento, fecha_programada_pago, moneda, total, estado, estado_aprobacion, pagos_proveedor(monto, monto_en_moneda_factura, deleted_at), proveedor_notas_credito(monto, estado, deleted_at)")
      .is("deleted_at", null)
      .neq("estado", "Cancelada")
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
      .limit(CAP_POSTGREST),
    [] as RowCruda[],
    // SAFE-CAST: el select con join anidado `pagos_proveedor(...)` produce un
    // shape sintetizado por PostgREST que el tipo generado de Supabase no
    // captura; RowCruda declara sólo las columnas que consumimos aquí.
  )) as unknown as RowCruda[];

  return rows
    .map((r) => {
      const pagado = sumarPagosEnMonedaFactura(r.pagos_proveedor);
      // A-2: el saldo programable debe restar las notas de crédito aplicadas,
      // igual que `saldo_factura_proveedor` y el listado de CxP. Sin esto la
      // bandeja proponía pagar más de lo que se debe.
      const nc = sumarNotasCreditoAplicadas(r.proveedor_notas_credito);
      const saldo = Math.max(0, Number(r.total) - pagado - nc);
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
