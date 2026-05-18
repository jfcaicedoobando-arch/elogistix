import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { usePortalEmbarques, usePortalClientUsers } from "@/hooks/portal/usePortalData";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";

type EmbarqueRow = ReturnType<typeof usePortalEmbarques>["data"] extends ReadonlyArray<infer U> | undefined ? U : never;

function embarqueMatchesSearch(e: EmbarqueRow, estadoVisual: string, q: string): boolean {
  const ruta = `${e.puerto_origen || ""} ${e.puerto_destino || ""} ${e.aeropuerto_origen || ""} ${e.aeropuerto_destino || ""} ${e.ciudad_origen || ""} ${e.ciudad_destino || ""}`.toLowerCase();
  return (
    e.expediente.toLowerCase().includes(q) ||
    e.cliente_nombre.toLowerCase().includes(q) ||
    ruta.includes(q) ||
    estadoVisual.toLowerCase().includes(q) ||
    (!!e.contenedor && e.contenedor.toLowerCase().includes(q))
  );
}

/**
 * Controller de la página /portal/embarques.
 * Centraliza queries (clientes vinculados + embarques), filtros (search, estado, modo)
 * y el agrupamiento por expediente. Soporta ?estado=XXX como filtro inicial vía
 * deep-link desde el dashboard.
 */
export function usePortalEmbarquesController() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = useMemo(() => clientUsers.map((cu) => cu.cliente_id), [clientUsers]);
  const { data: embarques = [], isLoading } = usePortalEmbarques(clienteIds);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialEstado = searchParams.get("estado") || "todos";

  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstadoState] = useState(initialEstado);
  const [filtroModo, setFiltroModo] = useState("todos");

  // Mantener URL en sync con el filtro de estado (limpio cuando vuelve a "todos").
  const setFiltroEstado = (val: string) => {
    setFiltroEstadoState(val);
    const next = new URLSearchParams(searchParams);
    if (val === "todos") next.delete("estado");
    else next.set("estado", val);
    setSearchParams(next, { replace: true });
  };

  // Si llega un nuevo deep-link mientras la página está montada, sincroniza.
  useEffect(() => {
    const fromUrl = searchParams.get("estado") || "todos";
    if (fromUrl !== filtroEstado) setFiltroEstadoState(fromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { estados, modos } = useMemo(() => {
    const estadoSet = new Set<string>();
    const modoSet = new Set<string>();
    embarques.forEach((e) => {
      estadoSet.add(calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado));
      modoSet.add(e.modo);
    });
    return { estados: Array.from(estadoSet).sort(), modos: Array.from(modoSet).sort() };
  }, [embarques]);

  const filtered = useMemo(() => {
    return embarques.filter((e) => {
      const estadoVisual = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
      if (filtroEstado !== "todos" && estadoVisual !== filtroEstado) return false;
      if (filtroModo !== "todos" && e.modo !== filtroModo) return false;
      if (!search) return true;
      return embarqueMatchesSearch(e, estadoVisual, search.toLowerCase());
    });
  }, [embarques, search, filtroEstado, filtroModo]);

  const grouped = useMemo(() => {
    const map = new Map<string, typeof filtered>();
    filtered.forEach((e) => {
      const key = e.expediente || "S/N";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return {
    isLoading,
    embarques,
    filtered,
    grouped,
    estados,
    modos,
    search,
    setSearch,
    filtroEstado,
    setFiltroEstado,
    filtroModo,
    setFiltroModo,
  };
}
