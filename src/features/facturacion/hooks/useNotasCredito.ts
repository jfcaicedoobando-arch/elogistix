import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  listarNotasCreditoPorFactura,
  listarNotasCreditoRecientes,
  crearNotaCredito,
  cambiarEstadoNotaCredito,
  type CrearNotaCreditoInput,
  type EstadoNotaCredito,
  type NotaCredito,
  type NotaCreditoConFactura,
  type ListarNotasCreditoRecientesFiltros,
} from "@/features/facturas/services/notasCredito";

export function useNotasCredito(facturaId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.facturas.notasCredito(facturaId ?? ""),
    queryFn: () => listarNotasCreditoPorFactura(facturaId!),
    enabled: !!facturaId,
  });
}

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

function invalidar(qc: ReturnType<typeof useQueryClient>, facturaId: string) {
  qc.invalidateQueries({ queryKey: queryKeys.facturas.notasCredito(facturaId) });
  qc.invalidateQueries({ queryKey: queryKeys.facturas.notasCreditoRecientes() });
  qc.invalidateQueries({ queryKey: queryKeys.facturas.cobranza() });
  qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
}

export function useCrearNotaCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearNotaCreditoInput) => crearNotaCredito(input),
    onSuccess: (_d, vars) => invalidar(qc, vars.factura_id),
  });
}

export function useCambiarEstadoNotaCredito() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      id: string;
      facturaId: string;
      estadoActual: EstadoNotaCredito;
      estadoNuevo: EstadoNotaCredito;
    }) => cambiarEstadoNotaCredito(params.id, params.estadoActual, params.estadoNuevo),
    onSuccess: (_d, vars) => invalidar(qc, vars.facturaId),
  });
}

export type { NotaCredito, EstadoNotaCredito, NotaCreditoConFactura };

