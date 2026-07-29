/**
 * Estado de página para `pages/cxp/Cxp.tsx`: filtros + selección de modales.
 * Extraído en v12.95.10 (Auditoría Paso 3) para que la página quede como
 * orquestador puro y el estado sea testeable de forma aislada.
 *
 * M10 (auditoría 2026-07-29): los filtros migraron de `useState` al helper
 * canónico `useTableFilters` (nuqs) — la URL `/compras/facturas?q=…&estatus=…`
 * es compartible, sobrevive al refresh y aplica los deep links sin efectos
 * mount-only. Los modales se quedan en `useState` (no son estado de URL).
 */
import { useState } from "react";
import { useDebounce } from "@/hooks/shared";
import { useTableFilters } from "@/hooks/shared/useTableFilters";
import type { FacturaCxP, EstatusCxP } from "@/features/cxp/services";

export type AprobacionFiltro = "todos" | "pendiente" | "aprobada" | "rechazada";

type CxpFiltrosUrl = {
  estatus: string;
  moneda: string;
  origen: string;
  aprobacion: string;
  proveedorId: string;
  categoriaPresupuestoId: string;
};

const DEFAULTS: CxpFiltrosUrl = {
  estatus: "todos",
  moneda: "todas",
  origen: "todos",
  aprobacion: "todos",
  proveedorId: "todos",
  categoriaPresupuestoId: "todas",
};

export function useCxpPageState() {
  const tf = useTableFilters<CxpFiltrosUrl>({
    defaultFilters: DEFAULTS,
    defaultPageSize: 100,
    filterLabels: {
      estatus: "Estatus",
      moneda: "Moneda",
      origen: "Origen",
      aprobacion: "Aprobación",
      proveedorId: "Proveedor",
      categoriaPresupuestoId: "Categoría",
    },
  });

  const search = tf.search;
  const debouncedSearch = useDebounce(search, 300);
  const page = tf.page;
  const pageSize = 100;
  const estatus = tf.filters.estatus as EstatusCxP | "todos";
  const moneda = tf.filters.moneda as "todas" | "MXN" | "USD" | "EUR";
  const origen = tf.filters.origen as "Nacional" | "Extranjero" | "todos";
  const aprobacion = tf.filters.aprobacion as AprobacionFiltro;
  const proveedorId = tf.filters.proveedorId;
  const categoriaPresupuestoId = tf.filters.categoriaPresupuestoId;
  const fechaDesde = tf.dateFrom;
  const fechaHasta = tf.dateTo;

  const [openNueva, setOpenNueva] = useState(false);
  const [pagar, setPagar] = useState<FacturaCxP | null>(null);
  const [detalle, setDetalle] = useState<FacturaCxP | null>(null);
  const [editar, setEditar] = useState<FacturaCxP | null>(null);
  const [aEliminar, setAEliminar] = useState<FacturaCxP | null>(null);

  // El reset de página lo hace `useListPageState` en `setSearch`/`setFilter`.

  const hayFiltros =
    search !== "" ||
    estatus !== "todos" ||
    moneda !== "todas" ||
    origen !== "todos" ||
    aprobacion !== "todos" ||
    proveedorId !== "todos" ||
    categoriaPresupuestoId !== "todas" ||
    fechaDesde !== "" ||
    fechaHasta !== "";

  const queryArgs = {
    search: debouncedSearch || undefined,
    estatus,
    moneda,
    origen,
    aprobacion,
    proveedor_id: proveedorId === "todos" ? undefined : proveedorId,
    categoria_presupuesto_id:
      categoriaPresupuestoId === "todas" ? undefined : categoriaPresupuestoId,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  };

  return {
    // Filtros (mismos nombres públicos que la versión useState)
    search,
    setSearch: tf.setSearch,
    debouncedSearch,
    page,
    setPage: tf.setPage,
    pageSize,
    estatus,
    setEstatus: (v: EstatusCxP | "todos") => tf.setFilter("estatus", v),
    moneda,
    setMoneda: (v: "todas" | "MXN" | "USD" | "EUR") => tf.setFilter("moneda", v),
    origen,
    setOrigen: (v: "Nacional" | "Extranjero" | "todos") => tf.setFilter("origen", v),
    aprobacion,
    setAprobacion: (v: AprobacionFiltro) => tf.setFilter("aprobacion", v),
    proveedorId,
    setProveedorId: (v: string) => tf.setFilter("proveedorId", v),
    categoriaPresupuestoId,
    setCategoriaPresupuestoId: (v: string) => tf.setFilter("categoriaPresupuestoId", v),
    fechaDesde,
    setFechaDesde: tf.setDateFrom,
    fechaHasta,
    setFechaHasta: tf.setDateTo,
    hayFiltros,
    queryArgs,
    // Modales
    openNueva, setOpenNueva,
    pagar, setPagar,
    detalle, setDetalle,
    editar, setEditar,
    aEliminar, setAEliminar,
  };
}
