import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  listarSeries,
  crearSerie,
  actualizarSerie,
  marcarSerieComoDefault,
  reservarFolio,
  obtenerSerieDefault,
  type FacturaSerie,
} from "@/services/facturas/series";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export function useFacturaSeries() {
  return useQuery({
    queryKey: queryKeys.facturas.series,
    queryFn: listarSeries,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSerieDefault() {
  return useQuery({
    queryKey: [...queryKeys.facturas.series, "default"],
    queryFn: obtenerSerieDefault,
    staleTime: 5 * 60 * 1000,
  });
}

function invalidarSeries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.facturas.series });
}

export function useCrearSerie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TablesInsert<"factura_series">) => crearSerie(input),
    onSuccess: () => invalidarSeries(qc),
  });
}

export function useActualizarSerie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<"factura_series"> }) =>
      actualizarSerie(id, patch),
    onSuccess: () => invalidarSeries(qc),
  });
}

export function useMarcarSerieDefault() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, organizationId }: { id: string; organizationId: string }) =>
      marcarSerieComoDefault(id, organizationId),
    onSuccess: () => invalidarSeries(qc),
  });
}

export function useReservarFolio() {
  return useMutation({
    mutationFn: (serieId: string) => reservarFolio(serieId),
  });
}

export type { FacturaSerie };
