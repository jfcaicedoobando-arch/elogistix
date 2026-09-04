/**
 * Controller del route `FacturaDetalle`: agrupa data-fetching + derivación
 * de flags/estados. Extraído para respetar el límite Power of 10
 * (≤200 líneas por archivo).
 */
import { useAcuseCancelacion } from "./useAcuseCancelacion";
import { useDescargarCfdi } from "./useDescargarCfdi";
import { useConceptosFactura } from "./useConceptosFactura";
import { useEliminarBorradorFactura } from "./useEliminarBorradorFactura";
import { useTimbrarRep } from "./useTimbrarRep";
import { useFactura, usePagosFactura } from ".";
import { useNotasCreditoAplicadas } from "./useSaldoFactura";
import { calcularSaldoFactura } from "@/lib/financial/saldoFactura";
import { deriveFacturaFlags } from "@/features/facturacion/domain/facturaFlags";
import { usePermissions } from "@/hooks/shared";

export function useFacturaDetalleController(id: string | undefined) {
  const { canEdit, canRegistrarCobro } = usePermissions();
  const { data: factura, isLoading, error, refetch } = useFactura(id);
  const acuse = useAcuseCancelacion(factura);
  const pagosQuery = usePagosFactura(id);
  const { data: pagos = [] } = pagosQuery;
  // P1: notas de crédito aplicadas — MISMA fuente/canon que `FacturaPagosSection`
  // (`@/lib/financial/saldoFactura`), para no mezclar dos saldos distintos en la
  // misma pantalla. Ambas lecturas comparten moneda con la factura.
  const notasQuery = useNotasCreditoAplicadas(id);
  const { data: notasAplicadas = [] } = notasQuery;
  // P1: un error de lectura de pagos o NC NO debe degradarse a "saldo cero"
  // (habilitaría cobros/NC duplicados). Se expone el error para bloquear
  // acciones y ofrecer reintento en la UI.
  const saldoError = pagosQuery.isError || notasQuery.isError;
  const refetchSaldo = () => {
    void pagosQuery.refetch();
    void notasQuery.refetch();
  };
  const { saldo, pagado: totalPagado } = calcularSaldoFactura(
    Number(factura?.total ?? 0), pagos, notasAplicadas, factura?.estado,
  );
  const pagoRepPendiente = pagos.find(
    (p) => p.estado_rep === "Pendiente" || p.estado_rep === "Error",
  );
  const pagosRepPendientes = pagos.filter(
    (p) => p.estado_rep === "Pendiente" || p.estado_rep === "Error",
  ).length;
  const flags = deriveFacturaFlags(factura, canEdit, { saldo, pagosRepPendientes, saldoError }, canRegistrarCobro);
  const handleDownload = useDescargarCfdi(factura?.id);
  const { eliminar, isPending: eliminando } = useEliminarBorradorFactura();
  const { data: conceptosVivos = [] } = useConceptosFactura(factura?.id);
  const timbrarRep = useTimbrarRep(factura?.id);

  return {
    canEdit, factura, isLoading, error, refetch, acuse, flags,
    pagoRepPendiente, handleDownload, eliminar, eliminando,
    conceptosVivos, timbrarRep, saldo, totalPagado,
    saldoError, refetchSaldo,
  };
}
