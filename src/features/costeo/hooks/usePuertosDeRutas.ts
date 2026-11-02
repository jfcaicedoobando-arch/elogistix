import { useMemo } from "react";
import { usePuertos } from "@/features/catalogos/hooks";
import type { PuertoOption } from "@/features/catalogos";
import { useCosteoRutas } from "@/features/costeo/hooks/useCosteoRutas";
import { destinosDeOrigen, origenesDeRutas } from "@/features/costeo/utils/puertosDeRutas";

/** Puertos elegibles en el comparador Top 3: sólo rutas activas dadas de alta. */
export function usePuertosDeRutas(origenId: string) {
  const rutas = useCosteoRutas();
  const catalogo = usePuertos();
  const fuentes = [rutas, catalogo];
  const isError = fuentes.some((fuente) => fuente.isError);
  const disponibles = !isError && fuentes.every((fuente) => fuente.isEnabled && fuente.data !== undefined);
  const isLoading = !isError && !disponibles;
  const isRetrying = fuentes.some((fuente) => fuente.isError && fuente.isFetching);
  const actualizando = disponibles && fuentes.some((fuente) => fuente.isFetching);
  const lista = catalogo.data as PuertoOption[] | undefined;

  // La caché sigue disponible durante un refresco sano. Si falla una fuente,
  // no acredita la elegibilidad: bloquear opciones y resultados hasta recuperar.
  const origenes = useMemo(
    () => disponibles ? origenesDeRutas(rutas.data ?? [], lista ?? []) : [],
    [rutas.data, lista, disponibles],
  );
  const destinos = useMemo(
    () => disponibles ? destinosDeOrigen(rutas.data ?? [], lista ?? [], origenId) : [],
    [rutas.data, lista, origenId, disponibles],
  );
  // refetch() puede saltarse enabled; no reintentar fuentes sin autorización.
  const reintentar = () => Promise.all(
    fuentes.filter((fuente) => fuente.isError && fuente.isEnabled)
      .map((fuente) => fuente.refetch({ cancelRefetch: false })),
  );
  return { origenes, destinos, isLoading, isError, isRetrying, actualizando,
    sinRutas: disponibles && origenes.length === 0, reintentar };
}
