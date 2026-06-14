/**
 * Hooks de liquidaciones de comisión: lectura + generación + registro de pago.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchLiquidaciones,
  generarLiquidacion,
  registrarPagoLiquidacion,
  type GenerarLiquidacionParams,
  type RegistrarPagoLiquidacionParams,
} from "@/features/comisiones/services";

export function useLiquidaciones() {
  return useQuery({
    queryKey: queryKeys.comisiones.liquidaciones(),
    queryFn: fetchLiquidaciones,
    staleTime: 30_000,
  });
}

export function useGenerarLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: GenerarLiquidacionParams) => generarLiquidacion(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.comisiones.all });
    },
  });
}

export function useRegistrarPagoLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: RegistrarPagoLiquidacionParams) => registrarPagoLiquidacion(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.comisiones.liquidaciones() });
    },
  });
}
