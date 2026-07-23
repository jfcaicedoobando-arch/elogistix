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
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";

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
      notifySuccess(undefined, { title: "Liquidación generada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al generar liquidación: ${error.message}`, error, method: "GENERATE_LIQUIDACION" });
    },
  });
}

export function useRegistrarPagoLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: RegistrarPagoLiquidacionParams) => registrarPagoLiquidacion(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.comisiones.liquidaciones() });
      notifySuccess(undefined, { title: "Pago de liquidación registrado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al registrar pago: ${error.message}`, error, method: "REGISTER_LIQUIDACION_PAYMENT" });
    },
  });
}
