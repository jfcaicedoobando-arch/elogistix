import { useMemo, useCallback } from "react";
import { useListPageState } from "@/hooks/useListPageState";
import { exportToCsv } from "@/generators/exportCsv";
import { useFacturas, useGastosPendientes, useMarcarCostoPagado } from "@/hooks/facturacion/useFacturas";
import { useRegistrarActividad } from "@/hooks/useBitacora";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { useProformasPendientes } from "@/hooks/embarque/useProformas";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

/**
 * Controller para la página de Pre-Facturación.
 * Encapsula filtros, búsqueda, paginación, mutaciones y export CSV.
 */
export function useFacturacionPageController() {
  const {
    search, filters, page, pageSize,
    setSearch, setFilter, setPage, setPageSize, paginate,
  } = useListPageState({ estado: "todos" });
  const filterEstado = filters.estado;

  const { data: facturas = [], isLoading: loadingFacturas } = useFacturas();
  const { data: gastosPendientes = [], isLoading: loadingGastos } = useGastosPendientes();
  const { data: proformasPendientes = [] } = useProformasPendientes();
  const marcarPagado = useMarcarCostoPagado();
  const { canEdit } = usePermissions();
  const { toast } = useToast();
  const registrarActividad = useRegistrarActividad();

  const filtered = useMemo(() => {
    return facturas.filter(factura => {
      const s = search.toLowerCase();
      const matchSearch = !search
        || factura.numero.toLowerCase().includes(s)
        || factura.cliente_nombre.toLowerCase().includes(s);
      const matchEstado = filterEstado === "todos" || factura.estado === filterEstado;
      return matchSearch && matchEstado;
    });
  }, [search, filterEstado, facturas]);

  const { items: paginatedFacturas, totalPages } = paginate(filtered);

  const handleMarcarPagado = useCallback((id: string) => {
    marcarPagado.mutate({ id }, {
      onSuccess: () => {
        registrarActividad.mutate({
          accion: 'editar',
          modulo: 'facturas',
          entidad_id: id,
          entidad_nombre: 'Gasto marcado como pagado',
        });
        notifySuccess(toast, { title: "Gasto marcado como pagado" });
      },
      onError: () => notifyError(toast, { title: "Error al marcar como pagado" }),
    });
  }, [marcarPagado, registrarActividad, toast]);

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

  return {
    // estado
    search, setSearch,
    filterEstado, setFilter,
    page, setPage,
    pageSize, setPageSize,
    // datos
    facturas,
    paginatedFacturas,
    totalPages,
    gastosPendientes,
    proformasPendientes,
    loadingFacturas,
    loadingGastos,
    // permisos / mutaciones
    canEdit,
    marcarPagadoPending: marcarPagado.isPending,
    handleMarcarPagado,
    exportarFacturasCsv,
  };
}
