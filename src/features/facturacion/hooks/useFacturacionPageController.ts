import { useMemo, useCallback, useRef, useState } from "react";
import { useListPageState, useDebounce, useOrgFilter, useRegistrarActividad, usePermissions } from "@/hooks/shared";
import { exportToCsv } from "@/generators/exportCsv";
import { exportarLayoutContable } from "@/generators/layoutContable";
import { useFacturasClientes, useFacturasListado } from "./useFacturas";
import { fetchFacturasParaExportar } from "../services/facturasCrud";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { todayLocalISO } from "@/lib/date/today";

/** Todos los filtros se aplican antes de paginar; exportar recorre el mismo universo. */
export function useFacturacionPageController({ fechaDesde: desde, fechaHasta: hasta, activeTab }: {
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  activeTab?: string;
} = {}) {
  const { organizationId } = useOrgFilter();
  const { search, filters, page, pageSize, setSearch, setFilter, setPage, setPageSize } =
    useListPageState({ estado: "todos", cliente: "todos" }, 100, [50, 100, 200, 500]);
  const filterEstado = filters.estado;
  const filterCliente = filters.cliente;
  const debouncedSearch = useDebounce(search, 300);
  const facturasEnabled = activeTab === undefined || activeTab === "emitidas";
  const fechaDesde = desde ?? "";
  const fechaHasta = hasta ?? "";
  const rangoInvalido = Boolean(fechaDesde && fechaHasta && fechaDesde > fechaHasta);
  const queryFilters = useMemo(() => ({
    organizationId: organizationId ?? null,
    search: debouncedSearch,
    estado: filterEstado,
    clienteNombre: filterCliente,
    fechaDesde,
    fechaHasta,
  }), [organizationId, debouncedSearch, filterEstado, filterCliente, fechaDesde, fechaHasta]);
  const listado = useFacturasListado({
    ...queryFilters, page, pageSize, enabled: facturasEnabled && !rangoInvalido,
  });
  const clientes = useFacturasClientes(facturasEnabled);
  const { facturas, totalCount } = useMemo(() => ({
    facturas: rangoInvalido ? [] : listado.data?.data ?? [],
    totalCount: rangoInvalido ? 0 : listado.data?.count ?? 0,
  }), [listado.data, rangoInvalido]);
  const { canEdit } = usePermissions();
  const registrarActividad = useRegistrarActividad();
  const [exportando, setExportando] = useState(false);
  const exportLock = useRef(false);
  const filtroPendiente = search !== debouncedSearch;

  const exportar = useCallback(async (formato: "csv" | "contable") => {
    if (exportLock.current || rangoInvalido || filtroPendiente) return;
    exportLock.current = true;
    setExportando(true);
    try {
      const rows = await fetchFacturasParaExportar(queryFilters);
      if (!rows.length) {
        notifyError(undefined, { title: "No hay facturas para exportar", description: "Ajusta los filtros e inténtalo de nuevo." });
        return;
      }
      if (formato === "contable") {
        await exportarLayoutContable(rows);
        registrarActividad.mutate({
          accion: "exportar", modulo: "facturas", entidad_id: "layout_contable",
          entidad_nombre: `Layout contable (${rows.length} facturas)`,
        });
      } else {
        exportToCsv(`facturas_${todayLocalISO()}.csv`, [
          { key: "numero", label: "# Factura" },
          { key: "expediente", label: "Expediente" },
          { key: "cliente", label: "Cliente" },
          { key: "total", label: "Monto" },
          { key: "moneda", label: "Moneda" },
          { key: "emision", label: "Emisión" },
          { key: "vencimiento", label: "Vencimiento" },
          { key: "estado", label: "Estado" },
        ], rows.map((f) => ({
          numero: f.numero, expediente: f.expediente, cliente: f.cliente_nombre,
          total: f.total, moneda: f.moneda, emision: f.fecha_emision,
          vencimiento: f.fecha_vencimiento, estado: f.estado,
        })));
      }
      notifySuccess(undefined, {
        title: formato === "contable" ? "Layout contable generado" : "CSV generado",
        description: `${rows.length} facturas exportadas con los filtros aplicados.`,
      });
    } catch (error) {
      notifyError(undefined, {
        title: "No se pudo completar la exportación", error,
        method: "FACTURACION_EXPORTAR", context: { formato },
      });
    } finally {
      exportLock.current = false;
      setExportando(false);
    }
  }, [queryFilters, registrarActividad, rangoInvalido, filtroPendiente]);

  return {
    search, setSearch, filterEstado, filterCliente, setFilter,
    page, setPage, pageSize, setPageSize,
    facturas, facturasFiltradas: facturas, paginatedFacturas: facturas,
    totalPages: Math.max(1, Math.ceil(totalCount / pageSize)), totalCount,
    clientesDisponibles: clientes.data ?? [],
    loadingClientes: clientes.isLoading,
    errorClientes: clientes.isError,
    refetchClientes: () => void clientes.refetch(),
    loadingFacturas: !rangoInvalido && (listado.isLoading || filtroPendiente),
    errorFacturas: listado.isError,
    refetchFacturas: () => void listado.refetch(),
    rangoInvalido, exportando,
    exportDisabled: exportando || rangoInvalido || filtroPendiente || listado.isLoading || listado.isError || !totalCount,
    canEdit,
    exportarFacturasCsv: () => exportar("csv"),
    exportarLayoutContable: () => exportar("contable"),
  };
}
