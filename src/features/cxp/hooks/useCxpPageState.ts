/**
 * Estado de página para `pages/cxp/Cxp.tsx`: filtros + selección de modales.
 * Extraído en v12.95.10 (Auditoría Paso 3) para que la página quede como
 * orquestador puro y el estado sea testeable de forma aislada.
 */
import { useEffect, useState } from "react";
import { useDebounce } from "@/hooks/shared";
import type { FacturaCxP, EstatusCxP } from "@/features/cxp/services";

export type AprobacionFiltro = "todos" | "pendiente" | "aprobada" | "rechazada";

export function useCxpPageState() {
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const [estatus, setEstatus] = useState<EstatusCxP | "todos">("todos");
  const [moneda, setMoneda] = useState<"todas" | "MXN" | "USD" | "EUR">("todas");
  const [origen, setOrigen] = useState<"Nacional" | "Extranjero" | "todos">("todos");
  const [aprobacion, setAprobacion] = useState<AprobacionFiltro>("todos");
  const [proveedorId, setProveedorId] = useState<string>("todos");
  const [categoriaPresupuestoId, setCategoriaPresupuestoId] = useState<string>("todas");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  const [openNueva, setOpenNueva] = useState(false);
  const [pagar, setPagar] = useState<FacturaCxP | null>(null);
  const [detalle, setDetalle] = useState<FacturaCxP | null>(null);
  const [editar, setEditar] = useState<FacturaCxP | null>(null);
  const [aEliminar, setAEliminar] = useState<FacturaCxP | null>(null);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, estatus, moneda, origen, aprobacion, proveedorId, categoriaPresupuestoId, fechaDesde, fechaHasta]);

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
    categoria_presupuesto_id: categoriaPresupuestoId === "todas" ? undefined : categoriaPresupuestoId,
    fecha_desde: fechaDesde || undefined,
    fecha_hasta: fechaHasta || undefined,
  };

  return {
    // Filtros
    search, setSearch, debouncedSearch,
    page, setPage, pageSize,
    estatus, setEstatus,
    moneda, setMoneda,
    origen, setOrigen,
    aprobacion, setAprobacion,
    proveedorId, setProveedorId,
    categoriaPresupuestoId, setCategoriaPresupuestoId,
    fechaDesde, setFechaDesde,
    fechaHasta, setFechaHasta,
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
