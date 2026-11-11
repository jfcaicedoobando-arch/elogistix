import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useOrgFilter } from "@/hooks/shared";
import { queryKeys } from "@/lib/query";
import {
  fetchCobranza,
  fetchCobranzaKpis,
  calcularKPIs,
  type EstatusCobranza,
} from "@/features/facturacion/services";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

export interface UseCobranzaFiltros {
  search?: string;
  cliente_id?: string;
  moneda?: Moneda | "todas";
  estatus?: EstatusCobranza | "todos";
}

/**
 * FIX C3c: los KPIs sólo pueden venir del servidor cuando los filtros activos
 * son los que la RPC `cobranza_agregados` sabe aplicar (cliente y moneda).
 * Con búsqueda de texto o filtro de estatus, el universo remoto ya no coincide
 * con la tabla visible, así que se agrega en cliente sobre la página cargada.
 */
function puedeAgregarEnServidor(f: UseCobranzaFiltros): boolean {
  const sinBusqueda = !f.search?.trim();
  const sinEstatus = !f.estatus || f.estatus === "todos";
  return sinBusqueda && sinEstatus;
}

export function useCobranzaFilas(filtros: UseCobranzaFiltros = {}) {
  const { organizationId, orgListo } = useOrgFilter();
  const filtrosLista = {
    ...filtros,
    moneda: filtros.moneda === "todas" ? undefined : filtros.moneda,
    estatus: filtros.estatus === "todos" ? undefined : filtros.estatus,
  };
  return useQuery({
    queryKey: queryKeys.facturas.cobranza({ organizationId, ...filtrosLista }),
    queryFn: ({ signal }) => fetchCobranza(filtrosLista, signal),
    enabled: orgListo,
    staleTime: 30_000,
  });
}

export function useCobranzaKpis(filtros: Pick<UseCobranzaFiltros, "cliente_id" | "moneda"> = {}, enabled = true) {
  const { organizationId, orgListo } = useOrgFilter();
  const filtrosAgregados = {
    cliente_id: filtros.cliente_id,
    moneda: filtros.moneda === "todas" ? undefined : filtros.moneda,
  };
  return useQuery({
    queryKey: queryKeys.facturas.cobranza({ organizationId, kpis: true, ...filtrosAgregados }),
    queryFn: ({ signal }) => fetchCobranzaKpis(filtrosAgregados, signal),
    enabled: enabled && orgListo,
    staleTime: 30_000,
  });
}

export function useCobranza(filtros: UseCobranzaFiltros = {}) {
  const query = useCobranzaFilas(filtros);
  const remotoHabilitado = puedeAgregarEnServidor(filtros);
  const kpisQuery = useCobranzaKpis(filtros, remotoHabilitado);
  const kpisLocales = useMemo(() => calcularKPIs(query.data ?? []), [query.data]);
  const kpis = useMemo(() => {
    const remoto = kpisQuery.data;
    if (!remotoHabilitado || !remoto) return kpisLocales;
    return { ...kpisLocales, ...remoto };
  }, [remotoHabilitado, kpisQuery.data, kpisLocales]);

  /**
   * Fail-closed: si la RPC remota estaba habilitada y falló, sus KPIs NO son
   * confiables y tampoco se sustituyen en silencio por los de la página
   * cargada (subestiman el universo). La tabla se conserva; los KPIs se
   * marcan en error para que la UI ofrezca reintentar.
   */
  const kpisIsError = remotoHabilitado && kpisQuery.isError;

  const refetchTodo = () => {
    void query.refetch();
    if (remotoHabilitado) void kpisQuery.refetch();
  };

  return {
    ...query,
    kpis,
    kpisIsLoading: remotoHabilitado && kpisQuery.isLoading,
    kpisIsError,
    kpisError: kpisIsError ? kpisQuery.error : null,
    kpisRefetch: () => void kpisQuery.refetch(),
    isError: query.isError || kpisIsError,
    error: query.error ?? (kpisIsError ? kpisQuery.error : null),
    refetch: refetchTodo,
  };
}
