import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTasaIVA } from "@/hooks/useTasaIVA";
import { useCotizacion, useEmbarquesVinculados } from "@/hooks/useCotizaciones";
import { usePermissions } from "@/hooks/usePermissions";
import {
  parseConceptos,
  calcularTotalesConceptos,
  getNombreDestinatario,
} from "@/lib/parsers/cotizacionDetalle";
import { useCotizacionDetalleHandlers } from "@/hooks/cotizacion/useCotizacionDetalleHandlers";

/**
 * Orquestador del detalle de cotización: combina queries (cotización + embarques vinculados),
 * totales calculados (lib puro) y handlers/mutations (hook dedicado).
 */
export function useCotizacionDetalleState(id: string | undefined) {
  const navigate = useNavigate();
  const { data: cotizacion, isLoading } = useCotizacion(id);
  const { canEdit } = usePermissions();
  const tasaIva = useTasaIVA();
  const { data: embarquesVinculados = [] } = useEmbarquesVinculados(cotizacion?.id);

  const totales = useMemo(() => {
    const conceptos = parseConceptos(cotizacion?.conceptos_venta);
    return calcularTotalesConceptos(conceptos, tasaIva);
  }, [cotizacion, tasaIva]);

  const handlers = useCotizacionDetalleHandlers(cotizacion);

  const nombreDestinatario = useMemo(() => getNombreDestinatario(cotizacion), [cotizacion]);

  return {
    cotizacion,
    isLoading,
    canEdit,
    tasaIva,
    embarquesVinculados,
    nombreDestinatario,
    // Totales
    conceptosVentaUSD: totales.conceptosVentaUSD,
    conceptosVentaMXN: totales.conceptosVentaMXN,
    totalUSD: totales.totalUSD,
    subtotalMXN: totales.subtotalMXN,
    ivaMXN: totales.ivaMXN,
    totalMXN: totales.totalMXN,
    // Handlers + diálogos
    ...handlers,
    navigate,
  };
}
