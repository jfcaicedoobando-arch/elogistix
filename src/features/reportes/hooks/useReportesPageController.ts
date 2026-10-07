import { useMemo } from "react";
import { format } from "date-fns";

import { exportToCsv } from "@/generators/exportCsv";
// `generarRentabilidadPdf` se importa dinámicamente dentro de `handleExportPdf`
// para evitar que @react-pdf/renderer (~1.4 MB) entre al bundle inicial.
import type { generarRentabilidadPdf as GenerarRentabilidadPdfFn } from "@/generators/rentabilidadPdf";
import { useRentabilidadClientes } from "@/features/cliente/hooks/useRentabilidadClientes";
import { toTitleCase } from "@/lib/formatters";
import { useReportesFilters } from "./useReportesFilters";
import { BASE_CSV_RENTABILIDAD } from "@/types/rentabilidad";
import { roundMoney } from "@/lib/financial/financialUtils";
import { usePdfExport } from "@/hooks/shared";
import { notifyWarning } from "@/lib/ui/appFeedback";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { captureAuthOperationScope } from "@/lib/auth/authOperationScope";

/**
 * Controller-hook que absorbe todo el estado, derivaciones y handlers de la
 * página de Reportes. Deja `Reportes.tsx` como composición pura de UI.
 */
export function useReportesPageController() {
  const { organization } = useOrganization();
  const { fechaDesde, fechaHasta, modo, sortField, sortDir, setFechaDesde,
    setFechaHasta, setModo, applyFilters, resetFilters, handleSort } = useReportesFilters();

  const filtros = useMemo(
    () => ({
      fechaDesde: format(fechaDesde, "yyyy-MM-dd"),
      fechaHasta: format(fechaHasta, "yyyy-MM-dd"),
      modo: modo === "all" ? undefined : modo,
    }),
    [fechaDesde, fechaHasta, modo],
  );

  const { clientes, kpis, isLoading, isError, refetch, isDataReady, dataOrganizationId } = useRentabilidadClientes(filtros);
  const { isExporting: isExportingPdf, run: runPdfExport } = usePdfExport({
    successTitle: "Reporte PDF descargado",
    method: "REPORTES_RENTABILIDAD_EXPORT_PDF",
  });

  const sorted = useMemo(() => {
    // v13.301.65 · Dedupe defensivo por `cliente_id` para evitar warnings de
    // React "duplicate key" cuando el RPC agrupa el mismo cliente en más
    // de una fila (join contra embarques con múltiples registros).
    const byId = new Map<string, (typeof clientes)[number]>();
    for (const c of clientes) if (!byId.has(c.cliente_id)) byId.set(c.cliente_id, c);
    const copy = Array.from(byId.values());
    copy.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      return sortDir === "desc" ? vb - va : va - vb;
    });
    return copy;
  }, [clientes, sortField, sortDir]);

  const top10 = useMemo(
    () =>
      [...clientes]
        .sort((a, b) => b.profit_usd - a.profit_usd)
        .slice(0, 10)
        .map((c) => {
          const nombre = toTitleCase(c.cliente_nombre);
          return {
            name: nombre,
            profit: roundMoney(c.profit_usd),
          };
        }),
    [clientes],
  );

  const hayEmbarquesSinTc = kpis.embarquesSinTc > 0;
  const datosDelTenant = isDataReady && !isLoading && !isError && organization?.id === dataOrganizationId;
  const validarDatosActuales = () => {
    if (datosDelTenant && captureAuthOperationScope().organizationId === dataOrganizationId) return true;
    notifyWarning(undefined, {
      title: "Exportación bloqueada",
      description: "Espera a que termine la carga del reporte de la organización activa o vuelve a intentarlo.",
      id: "reportes-export-tenant-no-listo",
    });
    return false;
  };

  const handleExport = () => {
    if (hayEmbarquesSinTc) {
      notifyWarning(undefined, {
        title: "Exportación bloqueada",
        description:
          "Hay embarques sin tipo de cambio resuelto: las cifras de rentabilidad están " +
          "incompletas. Resuelve el tipo de cambio antes de exportar un reporte exacto.",
        id: "reportes-export-sin-tc",
      });
      return;
    }
    if (!validarDatosActuales()) return;
    exportToCsv(
      `rentabilidad_clientes_${filtros.fechaDesde}_${filtros.fechaHasta}_${modo === "all" ? "todos" : modo.toLowerCase()}.csv`,
      [
        { key: "cliente_nombre", label: "Cliente" },
        { key: "total_embarques", label: "Embarques" },
        { key: "venta_usd", label: "Venta equivalente (USD)" },
        { key: "costo_usd", label: "Costo equivalente (USD)" },
        { key: "profit_usd", label: "Utilidad equivalente (USD)" },
        { key: "margen", label: "Margen %" },
        { key: "desde_eta", label: "Desde (ETA)" },
        { key: "hasta_eta", label: "Hasta (ETA)" },
        { key: "modo", label: "Modo" },
        { key: "base", label: "Base" },
      ],
      sorted.map((c) => ({
        ...c, margen: c.venta_usd === 0 ? "No calculable" : c.margen.toFixed(1),
        desde_eta: filtros.fechaDesde, hasta_eta: filtros.fechaHasta,
        modo: modo === "all" ? "Todos los modos" : modo, base: BASE_CSV_RENTABILIDAD,
      })),
    );
  };

  const handleExportPdf = () => {
    if (hayEmbarquesSinTc) {
      notifyWarning(undefined, {
        title: "Exportación bloqueada",
        description:
          "Hay embarques sin tipo de cambio resuelto: las cifras de rentabilidad están " +
          "incompletas. Resuelve el tipo de cambio antes de exportar un reporte exacto.",
        id: "reportes-export-sin-tc",
      });
      return;
    }
    if (!validarDatosActuales()) return;
    void runPdfExport(async () => {
      const scope = captureAuthOperationScope();
      if (!organization || organization.id !== scope.organizationId) {
        throw new Error("Selecciona una organización antes de exportar el reporte.");
      }
      const mod: { generarRentabilidadPdf: typeof GenerarRentabilidadPdfFn } = await import(
        "@/generators/rentabilidadPdf"
      );
      scope.assertCurrent();
      await mod.generarRentabilidadPdf({
        organizacion: { id: organization.id, nombre: organization.nombre },
        fechaDesde: filtros.fechaDesde,
        fechaHasta: filtros.fechaHasta,
        modo: filtros.modo,
        kpis: {
          total_venta_usd: kpis.revenue,
          total_costo_usd: kpis.revenue - kpis.profit,
          total_profit_usd: kpis.profit,
          margen_promedio: kpis.margenProm,
        },
        clientes: sorted,
      });
    });
  };

  return {
    // filtros
    fechaDesde,
    fechaHasta,
    modo,
    setFechaDesde,
    setFechaHasta,
    setModo,
    resetFilters,
    applyFilters,
    // datos
    kpis,
    isLoading,
    isError,
    refetch,
    sorted,
    top10,
    // tabla
    sortField,
    sortDir,
    handleSort,
    // acciones
    handleExport,
    handleExportPdf,
    isExportingPdf,
    canExport: datosDelTenant && sorted.length > 0 && !hayEmbarquesSinTc,
    hayEmbarquesSinTc,
  };
}
