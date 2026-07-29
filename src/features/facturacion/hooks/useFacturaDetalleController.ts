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
import { deriveFacturaFlags } from "@/features/facturacion/domain/facturaFlags";
import { usePermissions } from "@/hooks/shared";

export function useFacturaDetalleController(id: string | undefined) {
  const { canEdit, canRegistrarCobro } = usePermissions();
  const { data: factura, isLoading, error, refetch } = useFactura(id);
  const acuse = useAcuseCancelacion(factura);
  const { data: pagos = [] } = usePagosFactura(id);
  const totalPagado = pagos.reduce((s, p) => s + Number(p.monto_aplicado_factura ?? 0), 0);
  const saldo = Math.max(0, Number(factura?.total ?? 0) - totalPagado);
  const pagoRepPendiente = pagos.find(
    (p) => p.estado_rep === "Pendiente" || p.estado_rep === "Error",
  );
  const pagosRepPendientes = pagos.filter(
    (p) => p.estado_rep === "Pendiente" || p.estado_rep === "Error",
  ).length;
  const flags = deriveFacturaFlags(factura, canEdit, { saldo, pagosRepPendientes }, canRegistrarCobro);
  const handleDownload = useDescargarCfdi(factura?.id);
  const { eliminar, isPending: eliminando } = useEliminarBorradorFactura();
  const { data: conceptosVivos = [] } = useConceptosFactura(factura?.id);
  const timbrarRep = useTimbrarRep(factura?.id);

  return {
    canEdit, factura, isLoading, error, refetch, acuse, flags,
    pagoRepPendiente, handleDownload, eliminar, eliminando,
    conceptosVivos, timbrarRep, saldo, totalPagado,
  };
}
