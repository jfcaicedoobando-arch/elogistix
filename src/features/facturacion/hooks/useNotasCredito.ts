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
} from "@/features/facturacion/services/notasCredito";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

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
    onSuccess: (_d, vars) => {
      invalidar(qc, vars.factura_id);
      notifySuccess(undefined, { title: "Nota de crédito creada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al crear nota de crédito: ${error.message}`, error, method: "CREATE_NOTA_CREDITO" });
    },
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
    onSuccess: (_d, vars) => {
      invalidar(qc, vars.facturaId);
      notifySuccess(undefined, { title: `Nota de crédito ${vars.estadoNuevo}` });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al cambiar estado de nota: ${error.message}`, error, method: "CHANGE_NC_STATE" });
    },
  });
}

export type { NotaCredito, EstadoNotaCredito, NotaCreditoConFactura };

