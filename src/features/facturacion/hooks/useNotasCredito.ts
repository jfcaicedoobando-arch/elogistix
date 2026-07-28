import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  listarNotasCreditoRecientes,
  type EstadoNotaCredito,
  type ListarNotasCreditoRecientesFiltros,
} from "@/features/facturacion/services/notasCredito";

export function useNotasCreditoRecientes(filtros: ListarNotasCreditoRecientesFiltros = {}) {
  const key = useMemo(
    () => ({ cliente_id: filtros.cliente_id, estado: filtros.estado, limit: filtros.limit }),
    [filtros.cliente_id, filtros.estado, filtros.limit],
  );
  return useQuery({
    queryKey: queryKeys.facturas.notasCreditoRecientes(key),
    queryFn: () => listarNotasCreditoRecientes(filtros),
    staleTime: 60_000,
  });
}

export type {  EstadoNotaCredito,  };
