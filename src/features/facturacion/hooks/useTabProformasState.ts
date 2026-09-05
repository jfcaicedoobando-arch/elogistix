/**
 * Estado UI puro del tab de Proformas: filtros, paginación y derivados de filtrado.
 * Sin dependencias de mutaciones ni de columnas de UI.
 *
 * Filtros soportados (homologados al patrón de `/embarques`):
 *   - `search` texto libre sobre número, expediente, cliente y folio externo
 *   - `filtroEstado` unificado: todas | pendiente | aceptada | rechazada | facturada
 *   - `filtroCliente` id del cliente
 *   - `filtroOperador` email operador
 *   - `fechaDesde` / `fechaHasta` rango sobre `fecha_emision` (ISO YYYY-MM-DD)
 */
import { useState, useMemo } from "react";
import type { ProformaConFactura } from "@/features/embarques/hooks/useProformas";
import { DEFAULT_PAGE_SIZE } from "@/hooks/shared";
import { getEstadoUnificado, type EstadoUnificadoProforma } from "@/lib/domain/estadoUnificado";

export type FiltroEstadoProforma = "todas" | EstadoUnificadoProforma;

const TODOS = "todos";

function fechaEnRango(fecha: string | null | undefined, desde: string, hasta: string): boolean {
  if (!desde && !hasta) return true;
  if (!fecha) return false;
  const f = fecha.slice(0, 10);
  if (desde && f < desde) return false;
  if (hasta && f > hasta) return false;
  return true;
}

export function useTabProformasState(
  proformas: ProformaConFactura[],
  isInRange: (fecha: string | null | undefined) => boolean = () => true,
  estadoInicial: FiltroEstadoProforma = "todas",
) {
  const [search, setSearchState] = useState("");
  const [filtroEstado, setFiltroEstadoState] = useState<FiltroEstadoProforma>(estadoInicial);
  const [filtroCliente, setFiltroClienteState] = useState<string>(TODOS);
  const [filtroOperador, setFiltroOperadorState] = useState<string>(TODOS);
  const [fechaDesde, setFechaDesdeState] = useState<string>("");
  const [fechaHasta, setFechaHastaState] = useState<string>("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // P1 (auditoría v13.823.143 · bug 2): base con todos los filtros aplicados
  // EXCEPTO el de estado. Los contadores se calculan sobre ella para que
  // "Mostrando X de Y" nunca contradiga a los resultados visibles.
  const base = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proformas.filter((p) => {
      if (filtroCliente !== TODOS && p.cliente_id !== filtroCliente) return false;
      if (filtroOperador !== TODOS && (p.operador ?? "") !== filtroOperador) return false;
      if (!fechaEnRango(p.fecha_emision, fechaDesde, fechaHasta)) return false;
      if (!isInRange(p.fecha_emision)) return false;
      if (!q) return true;
      return (
        p.numero.toLowerCase().includes(q) ||
        p.expediente.toLowerCase().includes(q) ||
        p.cliente_nombre.toLowerCase().includes(q) ||
        (p.folio_factura_externa ?? "").toLowerCase().includes(q)
      );
    });
  }, [proformas, search, filtroCliente, filtroOperador, fechaDesde, fechaHasta, isInRange]);

  const filtered = useMemo(
    () => (filtroEstado === "todas" ? base : base.filter((p) => getEstadoUnificado(p) === filtroEstado)),
    [base, filtroEstado],
  );

  const counts = useMemo(
    () => ({
      todas: base.length,
      pendiente: base.filter((p) => getEstadoUnificado(p) === "pendiente").length,
      aceptada: base.filter((p) => getEstadoUnificado(p) === "aceptada").length,
      rechazada: base.filter((p) => getEstadoUnificado(p) === "rechazada").length,
      facturada: base.filter((p) => getEstadoUnificado(p) === "facturada").length,
    }),
    [base],
  );

  // Listas para poblar los selects Cliente / Operador. Únicos, ordenados alfa.
  const clientesDisponibles = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of proformas) {
      if (p.cliente_id && !map.has(p.cliente_id)) map.set(p.cliente_id, p.cliente_nombre);
    }
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es-MX"));
  }, [proformas]);

  const operadoresDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const p of proformas) if (p.operador) set.add(p.operador);
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [proformas]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize],
  );

  // Wrappers que resetean paginación al primer resultado en cualquier cambio de filtro.
  const wrap = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0); };

  const clearAll = () => {
    setFiltroEstadoState("todas");
    setFiltroClienteState(TODOS);
    setFiltroOperadorState(TODOS);
    setFechaDesdeState("");
    setFechaHastaState("");
    setPage(0);
  };

  return {
    search,
    filtroEstado,
    filtroCliente,
    filtroOperador,
    fechaDesde,
    fechaHasta,
    page,
    pageSize,
    setSearch: wrap(setSearchState),
    setFiltroEstado: wrap(setFiltroEstadoState),
    setFiltroCliente: wrap(setFiltroClienteState),
    setFiltroOperador: wrap(setFiltroOperadorState),
    setFechaDesde: wrap(setFechaDesdeState),
    setFechaHasta: wrap(setFechaHastaState),
    setPage,
    setPageSize: (s: number) => { setPageSize(s); setPage(0); },
    clearAll,
    filtered,
    paginated,
    counts,
    totalPages,
    clientesDisponibles,
    operadoresDisponibles,
  };
}
