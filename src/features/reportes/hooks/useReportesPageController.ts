import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";

import { exportToCsv } from "@/generators/exportCsv";
// `generarRentabilidadPdf` se importa dinámicamente dentro de `handleExportPdf`
// para evitar que @react-pdf/renderer (~1.4 MB) entre al bundle inicial.
import type { generarRentabilidadPdf as GenerarRentabilidadPdfFn } from "@/generators/rentabilidadPdf";
import { useRentabilidadClientes } from "@/features/cliente/hooks/useRentabilidadClientes";
import { toTitleCase } from "@/lib/formatters";
import type { SortField } from "@/features/reportes/components/ReportesTablaClientes";
import { roundMoney } from "@/lib/financial/financialUtils";
import { usePdfExport } from "@/hooks/shared";
import { notifyWarning } from "@/lib/ui/appFeedback";

/**
 * Controller-hook que absorbe todo el estado, derivaciones y handlers de la
 * página de Reportes. Deja `Reportes.tsx` como composición pura de UI.
 */
export function useReportesPageController() {
  const now = new Date();
  const [fechaDesde, setFechaDesde] = useState<Date>(startOfMonth(now));
  const [fechaHasta, setFechaHasta] = useState<Date>(endOfMonth(now));
  const [modo, setModo] = useState("all");
  const [sortField, setSortField] = useState<SortField>("profit_usd");

  // EC-13: nunca permitir un rango invertido (desde > hasta) — el RPC devolvería
  // vacío indistinguible de un periodo sin operación y el PDF/CSV saldría con
  // el rango invertido. Auto-corregimos el otro extremo y avisamos una vez.
  const avisarRangoInvertido = () =>
    notifyWarning(undefined, {
      title: "Rango de fechas ajustado",
      description: "La fecha «Desde» no puede ser posterior a «Hasta».",
      id: "reportes-rango-fechas-invertido",
    });

  const handleFechaDesde = (d: Date) => {
    setFechaDesde(d);
    if (d > fechaHasta) {
      setFechaHasta(endOfMonth(d));
      avisarRangoInvertido();
    }
  };

  const handleFechaHasta = (d: Date) => {
    setFechaHasta(d);
    if (d < fechaDesde) {
      setFechaDesde(startOfMonth(d));
      avisarRangoInvertido();
    }
  };
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtros = useMemo(
    () => ({
      fechaDesde: format(fechaDesde, "yyyy-MM-dd"),
      fechaHasta: format(fechaHasta, "yyyy-MM-dd"),
      modo: modo === "all" ? undefined : modo,
    }),
    [fechaDesde, fechaHasta, modo],
  );

  const { clientes, kpis, isLoading, isError, refetch } = useRentabilidadClientes(filtros);
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
            name: nombre.length > 18 ? nombre.slice(0, 18) + "…" : nombre,
            profit: roundMoney(c.profit_usd),
          };
        }),
    [clientes],
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const hayEmbarquesSinTc = kpis.embarquesSinTc > 0;

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
    exportToCsv(
      "rentabilidad_clientes.csv",
      [
        { key: "cliente_nombre", label: "Cliente" },
        { key: "total_embarques", label: "Embarques" },
        { key: "venta_usd", label: "Venta USD" },
        { key: "costo_usd", label: "Costo USD" },
        { key: "profit_usd", label: "Profit USD" },
        { key: "margen", label: "Margen %" },
      ],
      sorted.map((c) => ({ ...c, margen: c.margen.toFixed(1) })),
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
    void runPdfExport(async () => {
      const mod: { generarRentabilidadPdf: typeof GenerarRentabilidadPdfFn } = await import(
        "@/generators/rentabilidadPdf"
      );
      await mod.generarRentabilidadPdf({
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
    setFechaDesde: handleFechaDesde,
    setFechaHasta: handleFechaHasta,
    setModo,
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
    canExport: sorted.length > 0 && !hayEmbarquesSinTc,
    hayEmbarquesSinTc,
  };
}
