/**
 * Hook: datos + acciones de "Hueco de Facturación".
 * Aísla `useQuery` y la generación de CSV de la capa de UI.
 */
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import {
  fetchHuecoFacturacion,
  type FilaHueco,
  type HuecoFacturacionResult,
} from "@/services/facturas/huecoFacturacion";
import { exportToCsv } from "@/generators/exportCsv";
import { formatDate } from "@/lib/formatters";

export type { FilaHueco, HuecoFacturacionResult };

export function useHuecoFacturacion() {
  const { organizationId } = useOrgFilter();

  const { data, isLoading } = useQuery({
    queryKey: ["facturacion", "hueco", organizationId],
    queryFn: () => fetchHuecoFacturacion({ organizationId: organizationId ?? null }),
    staleTime: 60_000,
  });

  const filas = useMemo(() => data?.filas ?? [], [data?.filas]);
  const totalEmbarques = data?.totalEmbarques ?? 0;
  const totalUsd = data?.totalUsd ?? 0;
  const totalMxn = data?.totalMxn ?? 0;

  const exportarCsv = useCallback(() => {
    if (filas.length === 0) return;
    const hoy = new Date().toISOString().slice(0, 10);
    exportToCsv(
      `hueco_facturacion_${hoy}.csv`,
      [
        { key: "expediente", label: "Expediente" },
        { key: "cliente", label: "Cliente" },
        { key: "operador", label: "Operador" },
        { key: "etd", label: "ETD" },
        { key: "eta", label: "ETA" },
        { key: "bl_master", label: "BL Master" },
        { key: "bl_house", label: "BL House" },
        { key: "dias_sin_facturar", label: "Días sin facturar" },
        { key: "venta_usd", label: "Venta USD" },
        { key: "venta_mxn", label: "Venta MXN" },
      ],
      filas.map((f) => ({
        expediente: f.expediente,
        cliente: f.cliente_nombre,
        operador: f.operador,
        etd: f.etd ? formatDate(f.etd) : "",
        eta: f.eta ? formatDate(f.eta) : "",
        bl_master: f.bl_master ?? "",
        bl_house: f.bl_house ?? "",
        dias_sin_facturar: f.diasDesdeEtd,
        venta_usd: f.ventaUsd.toFixed(2),
        venta_mxn: f.ventaMxn.toFixed(2),
      })),
    );
  }, [filas]);

  return {
    isLoading,
    filas,
    totalEmbarques,
    totalUsd,
    totalMxn,
    exportarCsv,
  };
}
