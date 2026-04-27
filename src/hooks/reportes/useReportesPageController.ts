import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth } from "date-fns";

import { exportToCsv } from "@/generators/exportCsv";
import { useRentabilidadClientes } from "@/hooks/cliente/useRentabilidadClientes";
import { toTitleCase } from "@/lib/formatters";
import type { SortField } from "@/components/reportes/ReportesTablaClientes";

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
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const filtros = useMemo(
    () => ({
      fechaDesde: format(fechaDesde, "yyyy-MM-dd"),
      fechaHasta: format(fechaHasta, "yyyy-MM-dd"),
      modo: modo === "all" ? undefined : modo,
    }),
    [fechaDesde, fechaHasta, modo],
  );

  const { clientes, kpis, isLoading } = useRentabilidadClientes(filtros);

  const sorted = useMemo(() => {
    const copy = [...clientes];
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
            profit: Math.round(c.profit_usd * 100) / 100,
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

  const handleExport = () => {
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

  return {
    // filtros
    fechaDesde,
    fechaHasta,
    modo,
    setFechaDesde,
    setFechaHasta,
    setModo,
    // datos
    kpis,
    isLoading,
    sorted,
    top10,
    // tabla
    sortField,
    sortDir,
    handleSort,
    // acciones
    handleExport,
    canExport: sorted.length > 0,
  };
}
