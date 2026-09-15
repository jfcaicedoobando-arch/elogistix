/**
 * B-030 — Fetch directo de facturas programables para la bandeja semanal de
 * Tesorería. Antes la vista usaba la RPC `cxp_por_pagar`, que filtra
 * `estado = 'Vigente'` y dejaba fuera facturas en captura / por aprobar con
 * fecha programada (filtro implícito: la bandeja mostraba "2 de N").
 * Aquí se listan TODAS las facturas no canceladas con saldo > 0 y el filtro
 * queda explícito en la UI.
 */
import { supabase } from "@/integrations/supabase/client";
import { leerTodasLasPaginas } from "@/lib/supabase/paginado";
import type { FacturaProgramable } from "@/features/tesoreria/domain/pagosProgramados";
import { fetchSaldosProveedorFacturas } from "@/features/cxp";
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
}

const SELECT_PROGRAMABLES =
  "id, proveedor_nombre, folio_proveedor, fecha_vencimiento, fecha_programada_pago, moneda, total, estado, estado_aprobacion";

/**
 * Ronda YAGNI · defecto 4: antes se pedía una sola página tope de PostgREST con `unwrapOr([])`, así
 * que la factura 1001 no se veía ni se podía ejecutar y un error de consulta
 * (o RLS) se mostraba como bandeja vacía. Ahora se leen TODAS las páginas y el
 * error se propaga para que la ruta muestre reintento.
 */
export async function fetchPagosProgramables(): Promise<FacturaProgramableRow[]> {
  const rows = (await leerTodasLasPaginas<unknown>(
    "tesoreria.pagosProgramables",
    (desde, hasta) =>
      supabase
        .from("proveedor_facturas")
        .select(SELECT_PROGRAMABLES)
        .is("deleted_at", null)
        .neq("estado", "Cancelada")
        .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
        .order("id", { ascending: true })
        .range(desde, hasta),
    { lote: CAP_POSTGREST },
    // SAFE-CAST: RowCruda declara sólo las columnas que consumimos aquí.
  )) as RowCruda[];

  // N1 (v13.823.386): el saldo programable (pagos y notas de crédito
  // convertidos a la moneda de la factura) lo calcula el servidor con el canon
  // `monto_pago_en_moneda_factura`. Antes se sumaba `monto` crudo y una nota de
  // crédito en otra moneda hacía que la bandeja propusiera pagar de más.
  const saldos = await fetchSaldosProveedorFacturas(rows.map((r) => r.id));

  return rows
    // MNY-05: una factura rechazada no puede entrar al flujo de pago; la RPC la
    // bloquea y la bandeja no debe ofrecer "Ejecutar pago" sobre ella.
    .filter((r) => (r.estado_aprobacion ?? "").toLowerCase() !== "rechazada")
    // MNY-06: fail-closed. Si la vista canónica de saldos no trae la factura,
    // no se asume el total original (propondría pagar de más tras pagos/NC):
    // la fila queda fuera de la bandeja ejecutable.
    .filter((r) => saldos.has(r.id))
    .map((r) => {
      const saldo = Math.max(0, saldos.get(r.id)?.saldo ?? 0);
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
