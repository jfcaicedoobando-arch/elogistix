/**
 * Estado y handlers de la página `CosteoTarifas` extraídos para mantener el
 * componente por debajo de los límites de líneas/complejidad (eslint).
 */
import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { safeLocalStorage, STORAGE_KEYS } from "@/lib/browserStorage";
import { useCosteoTarifas, useCosteoTarifaMutations } from "@/features/costeo/hooks/useCosteoTarifas";
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import type { CosteoTarifaRow } from "@/features/costeo/types";
import {
  buildInitialFromTarifa, type EstadoFiltro, type AprobacionFiltro,
} from "./CosteoTarifas.helpers";
import { todayLocalISO } from "@/lib/date/today";

export type ViewMode = "agrupada" | "tabla";

const DEFAULT_APROB: AprobacionFiltro = "todas";
const DEFAULT_ESTADO: EstadoFiltro = "todas";

function readViewMode(): ViewMode {
  return safeLocalStorage.getItem(STORAGE_KEYS.tarifasViewMode) === "tabla" ? "tabla" : "agrupada";
}

function readAprobacionFromUrl(value: string | null): AprobacionFiltro {
  return value === "borrador" || value === "vigente" || value === "rechazada" ? value : DEFAULT_APROB;
}

export function useCosteoTarifasPageState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const rutaIdFromUrl = searchParams.get("ruta") ?? undefined;

  const [estado, setEstado] = useState<EstadoFiltro>(DEFAULT_ESTADO);
  // Alcance B: `?aprobacion=borrador` (link desde el KPI de Operaciones) preselecciona el filtro.
  const [aprobacion, setAprobacion] = useState<AprobacionFiltro>(() =>
    readAprobacionFromUrl(searchParams.get("aprobacion")),
  );
  const [agenteId, setAgenteId] = useState<string>("todos");
  const [tipoId, setTipoId] = useState<string>("todos");
  const [busqueda, setBusqueda] = useState("");
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<Partial<TarifaInput> | undefined>();
  const [editId, setEditId] = useState<string | undefined>();
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);

  const changeView = useCallback((v: ViewMode) => {
    setViewMode(v);
    safeLocalStorage.setItem(STORAGE_KEYS.tarifasViewMode, v);
  }, []);

  const tarifaFilters = useMemo(
    () => ({
      estado,
      agenteId: agenteId === "todos" ? undefined : agenteId,
      tipoContenedorId: tipoId === "todos" ? undefined : tipoId,
      rutaId: rutaIdFromUrl,
    }),
    [estado, agenteId, tipoId, rutaIdFromUrl],
  );

  const { data: tarifas = [], isLoading, isError, refetch } = useCosteoTarifas(tarifaFilters);
  const { eliminar } = useCosteoTarifaMutations();

  const tarifasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return tarifas.filter((t) => {
      if (aprobacion !== "todas" && (t.estado_aprobacion ?? "vigente") !== aprobacion) return false;
      if (!q) return true;
      const hay = `${t.puerto_origen_nombre} ${t.puerto_destino_nombre} ${t.agente_nombre} ${t.naviera_nombre}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tarifas, aprobacion, busqueda]);

  const pendientesCount = useMemo(
    () => tarifas.filter((t) => (t.estado_aprobacion ?? "vigente") === "borrador").length,
    [tarifas],
  );

  const hasActiveFilters =
    aprobacion !== DEFAULT_APROB ||
    estado !== DEFAULT_ESTADO ||
    agenteId !== "todos" ||
    tipoId !== "todos" ||
    busqueda.trim() !== "";

  const activeKpi: "pendientes" | "porVencer" | null =
    aprobacion === "borrador" ? "pendientes"
      : (aprobacion === "vigente" && estado === "vigente") ? "porVencer"
      : null;

  const clearAll = useCallback(() => {
    setAprobacion(DEFAULT_APROB);
    setEstado(DEFAULT_ESTADO);
    setAgenteId("todos");
    setTipoId("todos");
    setBusqueda("");
  }, []);

  const clearRutaUrl = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("ruta");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openFormFrom = useCallback((id: string | undefined, init: Partial<TarifaInput> | undefined) => {
    setEditId(id);
    setInitial(init);
    setOpen(true);
  }, []);

  const findTarifa = useCallback(
    (id: string): CosteoTarifaRow | undefined => tarifas.find((x) => x.id === id),
    [tarifas],
  );

  const duplicar = useCallback((id: string) => {
    const t = findTarifa(id);
    if (!t) return;
    openFormFrom(undefined, {
      ...buildInitialFromTarifa(t),
      vigente_desde: todayLocalISO(),
    });
  }, [findTarifa, openFormFrom]);

  const editar = useCallback((id: string) => {
    const t = findTarifa(id);
    if (!t) return;
    openFormFrom(id, buildInitialFromTarifa(t));
  }, [findTarifa, openFormFrom]);

  const nuevo = useCallback(() => openFormFrom(undefined, undefined), [openFormFrom]);

  const onFilterPendientes = useCallback(() => setAprobacion("borrador"), []);
  const onFilterPorVencer = useCallback(() => {
    setAprobacion("vigente");
    setEstado("vigente");
  }, []);

  return {
    // url
    rutaIdFromUrl,
    clearRutaUrl,
    // datos
    tarifas,
    tarifasFiltradas,
    isLoading,
    isError,
    refetch,
    pendientesCount,
    // filtros
    estado, setEstado,
    aprobacion, setAprobacion,
    agenteId, setAgenteId,
    tipoId, setTipoId,
    busqueda, setBusqueda,
    hasActiveFilters,
    clearAll,
    activeKpi,
    onFilterPendientes,
    onFilterPorVencer,
    // vista
    viewMode, changeView,
    // form
    open, setOpen, initial, editId,
    nuevo, editar, duplicar,
    // delete
    aEliminar, setAEliminar, eliminar,
  };
}

export { DEFAULT_APROB, DEFAULT_ESTADO };
