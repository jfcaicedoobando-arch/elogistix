import { useMemo, useCallback } from "react";
import { useListPageState } from "@/hooks/shared";
import { exportToCsv } from "@/generators/exportCsv";
import { exportarLayoutContable } from "@/generators/layoutContable";
import { useFacturas, useGastosPendientes, useMarcarCostoPagado } from "@/features/facturacion/hooks/useFacturas";
import { useRegistrarActividad } from "@/hooks/shared";
import { useToast } from "@/hooks/shared";
import { usePermissions } from "@/hooks/shared";

import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

import { ERROR_CODES } from "@/lib/domain/errorCatalog";
/**
 * Controller para la página de Facturación.
 * Encapsula filtros, búsqueda, paginación, mutaciones y export CSV.
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
    setSearch, setFilter, setPage, setPageSize, paginate,
  } = useListPageState({ estado: "todos", cliente: "todos" });
  const filterEstado = filters.estado;
  const filterCliente = filters.cliente;

  // Lazy fetching por tab activo (J de la auditoría). Sólo se aplica al listado
  // pesado de facturas; el resto se mantiene siempre activo para alimentar
  // badges/contadores que se ven desde cualquier tab.
  const facturasEnabled = activeTab === undefined || activeTab === "facturas";

  const { data: facturas = [], isLoading: loadingFacturas } = useFacturas({ enabled: facturasEnabled });
  const { data: gastosPendientes = [], isLoading: loadingGastos } = useGastosPendientes();

  const marcarPagado = useMarcarCostoPagado();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const registrarActividad = useRegistrarActividad();

  // Lista de clientes derivada de las facturas cargadas (evita fetch extra).
  const clientesDisponibles = useMemo(() => {
    const set = new Map<string, string>();
    for (const f of facturas) {
      if (f.cliente_nombre) set.set(f.cliente_nombre, f.cliente_nombre);
    }
    return Array.from(set.values())
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((n) => ({ id: n, nombre: n }));
  }, [facturas]);

  const filtered = useMemo(() => {
    return facturas.filter(factura => {
      const s = search.toLowerCase();
      const matchSearch = !search
        || factura.numero.toLowerCase().includes(s)
        || factura.cliente_nombre.toLowerCase().includes(s);
      const matchEstado = filterEstado === "todos" || factura.estado === filterEstado;
      const matchCliente = filterCliente === "todos" || factura.cliente_nombre === filterCliente;
      const matchFecha = isInRange(factura.fecha_emision);
      return matchSearch && matchEstado && matchCliente && matchFecha;
    });
  }, [search, filterEstado, filterCliente, facturas, isInRange]);

  const gastosFiltrados = useMemo(
    () => gastosPendientes.filter((g) => isInRange(g.fecha_vencimiento)),
    [gastosPendientes, isInRange],
  );


  const { items: paginatedFacturas, totalPages } = paginate(filtered);

  // 13.85.10 — Toasts viven en `useMarcarCostoPagado`. Aquí sólo registramos actividad.
  const handleMarcarPagado = useCallback((id: string) => {
    marcarPagado.mutate({ id }, {
      onSuccess: () => {
        registrarActividad.mutate({
          accion: 'editar',
          modulo: 'facturas',
          entidad_id: id,
          entidad_nombre: 'Gasto marcado como pagado',
        });
      },
    });
  }, [marcarPagado, registrarActividad]);


  const exportarFacturasCsv = useCallback(() => {
    exportToCsv(
      `facturas_${new Date().toISOString().slice(0, 10)}.csv`,
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
      notifySuccess(toast, { title: "Layout contable generado" });
    } catch {
      notifyError(toast, { title: "Error al generar layout contable", method: "ON_ERROR", errorCode: ERROR_CODES.VALIDATION_FAILED });
    }
  }, [filtered, registrarActividad, toast]);

  return {
    // estado
    search, setSearch,
    filterEstado, setFilter,
    page, setPage,
    pageSize, setPageSize,
    // datos
    facturas,
    facturasFiltradas: filtered,
    paginatedFacturas,
    totalPages,
    gastosPendientes: gastosFiltrados,
    
    loadingFacturas,
    loadingGastos,
    // permisos / mutaciones
    canEdit,
    marcarPagadoPending: marcarPagado.isPending,
    handleMarcarPagado,
    exportarFacturasCsv,
    exportarLayoutContable: exportarLayoutContableHandler,
  };
}

