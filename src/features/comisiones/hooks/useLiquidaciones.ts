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
import { getErrorMessage } from "@/lib/errors";

export function useLiquidaciones() {
  return useQuery({
    queryKey: queryKeys.comisiones.liquidaciones(),
    queryFn: fetchLiquidaciones,
    staleTime: 30_000,
  });
}

/** BL-05: la BD ya impide dos liquidaciones del mismo periodo (unique 23505). */
function mensajeGenerarLiquidacion(error: Error): string {
  const raw = getErrorMessage(error);
  if (raw.includes("uq_liquidaciones_comision_org_vendedora_periodo") || raw.includes("23505")) {
    return "Ya existe una liquidación para esa vendedora y periodo; revisa el listado antes de generar otra.";
  }
  return raw;
}

export function useGenerarLiquidacion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: GenerarLiquidacionParams) =>
      generarLiquidacion({ ...p, request_id: p.request_id ?? crypto.randomUUID() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.comisiones.all });
      notifySuccess(undefined, { title: "Liquidación generada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo generar liquidación", description: mensajeGenerarLiquidacion(error), error, method: "GENERATE_LIQUIDACION" });
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
      notifyError(undefined, { title: "No se pudo registrar pago", description: getErrorMessage(error), error, method: "REGISTER_LIQUIDACION_PAYMENT" });
    },
  });
}
