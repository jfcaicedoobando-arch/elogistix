import { useMemo, useCallback } from "react";
import { useListPageState, useDebounce } from "@/hooks/shared";
import { exportToCsv } from "@/generators/exportCsv";
import { exportarLayoutContable } from "@/generators/layoutContable";
import { useFacturasListado } from "@/features/facturacion/hooks/useFacturas";
import { useRegistrarActividad } from "@/hooks/shared";
import { usePermissions } from "@/hooks/shared";

import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
import { todayLocalISO } from "@/lib/date/today";
/**
 * Controller para la página de Facturación.
 * Encapsula filtros, búsqueda, paginación, mutaciones y export CSV.
 *
 * v13.317.3 (P7) — paginación server-side vía `useFacturasListado`.
 * El RPC `facturas_listado` filtra `search` y `estado` en SQL; los filtros
 * de cliente y rango de fechas se aplican client-side sobre la página
 * (limitación asumida: solo aplican a las filas visibles).
 */
export function useFacturacionPageController(opts?: {
  isInRange?: (fecha: string | null | undefined) => boolean;
  activeTab?: string;
}) {
  const optsIsInRange = opts?.isInRange;
  const activeTab = opts?.activeTab;
  const isInRange = useMemo(() => optsIsInRange ?? (() => true), [optsIsInRange]);
  const {
    search, filters, page, pageSize,
    setSearch, setFilter, setPage, setPageSize,
  } = useListPageState({ estado: "todos", cliente: "todos" }, 100);
  const filterEstado = filters.estado;
  const filterCliente = filters.cliente;

  // Debounce del search para no disparar refetch por tecla (300ms alineado
  // con los patrones de Embarques y CxP).
  const debouncedSearch = useDebounce(search, 300);

  // Lazy fetching por tab activo (J de la auditoría). Sólo se aplica al listado
  // pesado de facturas; el resto se mantiene siempre activo para alimentar
  // badges/contadores que se ven desde cualquier tab.
  // El id real de la bandeja de emitidas es "emitidas": con "facturas" el
  // guard nunca coincidía y la query pesada quedaba habilitada en todos los tabs.
  const facturasEnabled = activeTab === undefined || activeTab === "emitidas";

  const { data: listado, isLoading: loadingFacturas, isError: errorFacturas, refetch: refetchFacturas } = useFacturasListado({
    page,
    pageSize,
    search: debouncedSearch,
    estado: filterEstado,
    enabled: facturasEnabled,
  });
  const facturas = useMemo(() => listado?.data ?? [], [listado]);
  const totalCount = listado?.count ?? 0;
  const { canEdit } = usePermissions();
  const registrarActividad = useRegistrarActividad();

  // Lista de clientes derivada de la página actual (limitación conocida:
  // solo refleja los clientes visibles). Se mantiene para compatibilidad;
  // si se necesita el catálogo completo, hacerlo con una query aparte.
  const clientesDisponibles = useMemo(() => {
    const set = new Map<string, string>();
    for (const f of facturas) {
      if (f.cliente_nombre) set.set(f.cliente_nombre, f.cliente_nombre);
    }
    return Array.from(set.values())
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((n) => ({ id: n, nombre: n }));
  }, [facturas]);

  // Filtros que siguen client-side (cliente y rango de fechas) — se aplican
  // sobre la página ya paginada por el server.
  const filtered = useMemo(() => {
    return facturas.filter((factura) => {
      const matchCliente = filterCliente === "todos" || factura.cliente_nombre === filterCliente;
      const matchFecha = isInRange(factura.fecha_emision);
      return matchCliente && matchFecha;
    });
  }, [filterCliente, facturas, isInRange]);

  const paginatedFacturas = filtered;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));



  const exportarFacturasCsv = useCallback(() => {
    exportToCsv(
      `facturas_${todayLocalISO()}.csv`,
      [
        { key: "numero", label: "# Factura" },
        { key: "expediente", label: "Expediente" },
        { key: "cliente", label: "Cliente" },
        { key: "total", label: "Monto" },
        { key: "moneda", label: "Moneda" },
        { key: "emision", label: "Emisión" },
        { key: "vencimiento", label: "Vencimiento" },
        { key: "estado", label: "Estado" },
      ],
      filtered.map(f => ({
        numero: f.numero,
        expediente: f.expediente,
        cliente: f.cliente_nombre,
        total: f.total,
        moneda: f.moneda,
        emision: f.fecha_emision,
        vencimiento: f.fecha_vencimiento,
        estado: f.estado,
      })),
    );
  }, [filtered]);

  const exportarLayoutContableHandler = useCallback(async () => {
    try {
      await exportarLayoutContable(filtered);
      registrarActividad.mutate({
        accion: 'exportar',
        modulo: 'facturas',
        entidad_id: 'layout_contable',
        entidad_nombre: `Layout contable (${filtered.length} facturas)`,
      });
      notifySuccess(undefined, { title: "Layout contable generado" });
    } catch {
      notifyError(undefined, { title: "Error al generar layout contable", method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    }
  }, [filtered, registrarActividad]);

  return {
    // estado
    search, setSearch,
    filterEstado, filterCliente, setFilter,
    page, setPage,
    pageSize, setPageSize,
    // datos
    facturas,
    facturasFiltradas: filtered,
    paginatedFacturas,
    totalPages,
    totalCount,
    clientesDisponibles,

    loadingFacturas,
    // P1-1: la tabla debe pintar error + retry, no un empty-state engañoso.
    errorFacturas,
    refetchFacturas: () => void refetchFacturas(),
    // permisos / mutaciones
    canEdit,
    exportarFacturasCsv,
    exportarLayoutContable: exportarLayoutContableHandler,
  };
}

