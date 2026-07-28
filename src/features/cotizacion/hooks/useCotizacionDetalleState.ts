import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { useCotizacion, useEmbarquesVinculados } from "@/features/cotizacion/hooks/useCotizaciones";
import { usePermissions } from "@/hooks/shared/usePermissions";
import {
  parseConceptos,
  calcularTotalesConceptos,
  getNombreDestinatario,
  EMPTY_TOTALES,
} from "@/lib/domain/cotizacionDetalle";
import { useCotizacionDetalleHandlers } from "@/features/cotizacion/hooks/useCotizacionDetalleHandlers";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import { logger } from "@/lib/observability/logger";

/**
 * Orquestador del detalle de cotización: combina queries (cotización + embarques vinculados),
 * totales calculados (lib puro) y handlers/mutations (hook dedicado).
 *
 * Defensivo: ante schema corrupto o errores de parseo, degrada a EMPTY_TOTALES (referencia
 * estable) y registra el incidente en consola sin romper el árbol de componentes.
 */
export function useCotizacionDetalleState(id: string | undefined) {
  const navigate = useNavigate();
  const { data: cotizacion, isLoading } = useCotizacion(id);
  const { canEdit } = usePermissions();
  const tasaIva = useTasaIVA();
  const { data: embarquesVinculados = [] } = useEmbarquesVinculados(cotizacion?.id);

  // Dep granular: sólo recalcular cuando cambia el JSON de conceptos o la tasa IVA,
  // evitando recálculos cuando otros campos de `cotizacion` mutan por refetch.
  const conceptosRaw = cotizacion?.conceptos_venta;
  const totales = useMemo(() => {
    try {
      const conceptos = parseConceptos(conceptosRaw);
      return calcularTotalesConceptos(conceptos, tasaIva);
    } catch (err) {
      logger.error("useCotizacionDetalleState", "error calculando totales", err);
      reportCaughtError(err, { feature: "cotizacion", op: "calcular_totales" });
      return EMPTY_TOTALES;
    }
  }, [conceptosRaw, tasaIva]);

  const handlers = useCotizacionDetalleHandlers(cotizacion ?? undefined);

  const esProspecto = cotizacion?.es_prospecto;
  const prospectoEmpresa = cotizacion?.prospecto_empresa;
  const clienteNombre = cotizacion?.cliente_nombre;
  const nombreDestinatario = useMemo(
    () =>
      getNombreDestinatario(
        cotizacion
          ? {
              es_prospecto: !!esProspecto,
              prospecto_empresa: prospectoEmpresa ?? "",
              cliente_nombre: clienteNombre ?? "",
            }
          : undefined,
      ),
    [cotizacion, esProspecto, prospectoEmpresa, clienteNombre],
  );

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
