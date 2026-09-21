/**
 * P1-B — Controlador de /compras/reportes.
 *
 * Concentra rango de fechas, consultas (facturas del período + tipos de cambio
 * DOF), agregaciones y exportación CSV. La página sólo renderiza y conecta
 * eventos. Sin JSX.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { compras } from "../queryKeys";
import { fetchFacturasReporte } from "@/features/compras/services/reportesFetch";
import { fetchExchangeRates } from "@/features/catalogos/services";
import {
  agruparEvolucionMensual,
  agruparTopProveedores,
} from "@/features/compras/services/reportesAgregados";
import { todayLocalISO } from "@/lib/date/today";
import { descargarBlob } from "@/lib/downloadBlob";
import { toCSV } from "@/lib/io/csv";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";

function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`;
}

export function useComprasReportesController() {
  const [desde, setDesde] = useState<string>(firstOfYear());
  const [hasta, setHasta] = useState<string>(todayLocalISO());
  const { organizationId, orgListo } = useOrgFilter();

  const { data: rows = [], isLoading, isError, refetch } = useQuery({
    queryKey: compras.reportes({ desde, hasta }, organizationId),
    queryFn: () => fetchFacturasReporte(desde, hasta, organizationId),
    // N-3: no consultar hasta que el contexto de organización resolvió.
    enabled: orgListo,
  });

  const { data: rates } = useQuery({
    queryKey: compras.exchangeRatesDofToday(),
    queryFn: () => fetchExchangeRates(todayLocalISO()),
    staleTime: 1000 * 60 * 60,
  });

  const totalMxn = rows.filter((r) => r.moneda === "MXN").reduce((a, r) => a + r.total, 0);
  const totalUsd = rows.filter((r) => r.moneda === "USD").reduce((a, r) => a + r.total, 0);
  const totalEur = rows.filter((r) => r.moneda === "EUR").reduce((a, r) => a + r.total, 0);

  const tcDof = rates?.usdMxn;
  const tcEurDof = rates?.eurMxn;

  // Top proveedores — agrupamos por proveedor y moneda.
  const topProveedores = useMemo(
    () => agruparTopProveedores(rows, tcDof, tcEurDof),
    [rows, tcDof, tcEurDof],
  );

  // Evolución mensual (YYYY-MM) por moneda.
  const evolucion = useMemo(() => agruparEvolucionMensual(rows), [rows]);

  const handleExport = () => {
    try {
      const csv = toCSV(
        topProveedores.map((p) => ({
          proveedor: p.nombre,
          facturas: p.count,
          total_mxn: p.mxn,
          total_usd: p.usd,
          total_eur: p.eur,
          total_equivalente_mxn: p.mxnEquiv,
        })),
      );
      descargarBlob(
        new Blob([csv], { type: "text/csv;charset=utf-8" }),
        `compras-top-proveedores-${desde}-${hasta}.csv`,
      );
      notifySuccess(undefined, {
        title: "CSV descargado",
        description: `${topProveedores.length} proveedores exportados.`,
      });
    } catch (e) {
      notifyError(undefined, {
        title: "No se pudo exportar el CSV",
        error: e,
        method: "EXPORT_REPORTES_CSV",
      });
    }
  };

  return {
    desde, setDesde, hasta, setHasta,
    isLoading, isError, refetch,
    numFacturas: rows.length,
    totalMxn, totalUsd, totalEur,
    topProveedores, evolucion,
    handleExport,
  };
}
