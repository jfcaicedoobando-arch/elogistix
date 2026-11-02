import { useMemo } from "react";
import { usePuertos } from "@/features/catalogos/hooks";
import type { PuertoOption } from "@/features/catalogos";
import { useCosteoRutas } from "@/features/costeo/hooks/useCosteoRutas";
import { destinosDeOrigen, origenesDeRutas } from "@/features/costeo/utils/puertosDeRutas";

/** Puertos elegibles en el comparador Top 3: sólo rutas activas dadas de alta. */
export function usePuertosDeRutas(origenId: string) {
  const { data: rutas = [], isLoading } = useCosteoRutas();
  const { data: catalogo = [] } = usePuertos();
  const lista = catalogo as PuertoOption[];
  const origenes = useMemo(() => origenesDeRutas(rutas, lista), [rutas, lista]);
  const destinos = useMemo(() => destinosDeOrigen(rutas, lista, origenId), [rutas, lista, origenId]);
  return { origenes, destinos, isLoading, sinRutas: !isLoading && origenes.length === 0 };
}
