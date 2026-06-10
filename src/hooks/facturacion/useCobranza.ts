import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchCobranza, calcularKPIs, type EstatusCobranza } from "@/services/facturas";
import type { Database } from "@/integrations/supabase/types";

type Moneda = Database["public"]["Enums"]["moneda"];

export interface UseCobranzaFiltros {
  search?: string;
  cliente_id?: string;
  moneda?: Moneda | "todas";
  estatus?: EstatusCobranza | "todos";
}

export function useCobranza(filtros: UseCobranzaFiltros = {}) {
  const key = useMemo(
    () => ({
      search: filtros.search, cliente_id: filtros.cliente_id,
      moneda: filtros.moneda, estatus: filtros.estatus,
    }),
    [filtros.search, filtros.cliente_id, filtros.moneda, filtros.estatus],
  );
  const query = useQuery({
    queryKey: queryKeys.facturas.cobranza(key),
    queryFn: () => fetchCobranza(filtros),
    staleTime: 30_000,
  });
  const kpis = useMemo(() => calcularKPIs(query.data ?? []), [query.data]);
  return { ...query, kpis };
}
