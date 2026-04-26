import { useMemo, useState } from "react";
import { usePortalEmbarques, usePortalClientUsers } from "@/hooks/portal/usePortalData";
import { calcularEstadoEmbarque } from "@/lib/domain/embarque";

/**
 * Controller de la página /portal/embarques.
 * Centraliza queries (clientes vinculados + embarques), filtros (search, estado, modo)
 * y el agrupamiento por expediente. La page consume datos derivados ya listos para
 * pintar.
 */
export function usePortalEmbarquesController() {
  const { data: clientUsers = [] } = usePortalClientUsers();
  const clienteIds = useMemo(() => clientUsers.map((cu) => cu.cliente_id), [clientUsers]);
  const { data: embarques = [], isLoading } = usePortalEmbarques(clienteIds);

  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroModo, setFiltroModo] = useState("todos");

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
      if (search) {
        const q = search.toLowerCase();
        const ruta = `${e.puerto_origen || ""} ${e.puerto_destino || ""} ${e.aeropuerto_origen || ""} ${e.aeropuerto_destino || ""} ${e.ciudad_origen || ""} ${e.ciudad_destino || ""}`.toLowerCase();
        return (
          e.expediente.toLowerCase().includes(q) ||
          e.cliente_nombre.toLowerCase().includes(q) ||
          ruta.includes(q) ||
          estadoVisual.toLowerCase().includes(q) ||
          (e.contenedor && e.contenedor.toLowerCase().includes(q))
        );
      }
      return true;
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
