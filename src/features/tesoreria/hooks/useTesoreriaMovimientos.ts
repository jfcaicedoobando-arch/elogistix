/**
 * Hooks de movimientos bancarios e conciliación.
 * Extraído de `index.ts` (Auditoría Paso 2: purga de barrels).
 */
import { useQuery } from "@tanstack/react-query";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  listarMovimientos, importarMovimientos, conciliarConPago, desconciliarMovimiento,
  ignorarMovimiento, sugerirCandidatos, fetchConciliacionResumen, registrarMovimientoManual,
  eliminarMovimientoManual,
  type FiltrosMovimientos, type MovimientoBBVA, type MovimientoManualPayload,
} from "@/features/tesoreria/services";
import type { MovimientoParseado } from "@/features/tesoreria/domain/import/bbva";
import { useMutationWithFeedback } from "@/hooks/shared";

export function useMovimientos(filtros: FiltrosMovimientos | null) {
  return useQuery({
    queryKey: queryKeys.tesoreria.movimientos(filtros?.cuenta_bancaria_id ?? null, filtros),
    queryFn: () => listarMovimientos(filtros!),
    enabled: !!filtros?.cuenta_bancaria_id,
    staleTime: 30_000,
  });
}

/**
 * FIX C3c: resumen (conteos y montos pendientes) calculado en el servidor sobre
 * todos los movimientos de la cuenta, no sólo sobre la página visible.
 */
export function useConciliacionResumen(cuentaBancariaId: string | null) {
  return useQuery({
    queryKey: queryKeys.tesoreria.conciliacionResumen(cuentaBancariaId),
    queryFn: () => fetchConciliacionResumen(cuentaBancariaId!),
    enabled: !!cuentaBancariaId,
    staleTime: 30_000,
  });
}


export function useImportarMovimientos() {
  const { user } = useAuth();
  return useMutationWithFeedback({
    mutationFn: ({ cuentaId, movimientos }: { cuentaId: string; movimientos: MovimientoParseado[] }) =>
      importarMovimientos(cuentaId, movimientos, user?.id ?? null),
    invalidate: queryKeys.tesoreria.all,
    errorTitle: "Error al importar movimientos",
    errorMethod: "IMPORT_MOVIMIENTOS",
    onSuccess: (_data, vars) => {
      notifySuccess(undefined, { title: `${vars.movimientos.length} movimientos importados` });
    },
  });
}

export function useSugerirCandidatos(mov: MovimientoBBVA | null) {
  return useQuery({
    queryKey: queryKeys.tesoreria.candidatos(mov?.id ?? null),
    queryFn: () => sugerirCandidatos(mov!),
    enabled: !!mov,
    staleTime: 30_000,
  });
}

export function useConciliarPago() {
  const { user } = useAuth();
  return useMutationWithFeedback({
    mutationFn: (v: { movId: string; tipo: "cxc" | "cxp"; pagoId: string }) =>
      conciliarConPago(v.movId, v.tipo, v.pagoId, user?.id ?? null),
    invalidate: queryKeys.tesoreria.all,
    successTitle: "Movimiento conciliado",
    errorTitle: "Error al conciliar",
    errorMethod: "CONCILIAR_PAGO",
  });
}

export function useDesconciliar() {
  return useMutationWithFeedback({
    mutationFn: (movId: string) => desconciliarMovimiento(movId),
    invalidate: queryKeys.tesoreria.all,
    successTitle: "Movimiento desconciliado",
    errorTitle: "Error al desconciliar",
    errorMethod: "DESCONCILIAR",
  });
}

export function useIgnorarMovimiento() {
  return useMutationWithFeedback({
    mutationFn: ({ movId, motivo }: { movId: string; motivo: string }) =>
      ignorarMovimiento(movId, motivo),
    invalidate: queryKeys.tesoreria.all,
    successTitle: "Movimiento ignorado",
    errorTitle: "Error al ignorar movimiento",
    errorMethod: "IGNORAR_MOVIMIENTO",
  });
}

/** Q-15.7: alta manual de movimiento bancario (fuera del importador). */
export function useRegistrarMovimientoManual() {
  const { user } = useAuth();
  return useMutationWithFeedback({
    mutationFn: (v: Omit<MovimientoManualPayload, "userId">) =>
      registrarMovimientoManual({ ...v, userId: user?.id ?? null }),
    invalidate: queryKeys.tesoreria.all,
    successTitle: "Movimiento registrado",
    errorTitle: "Error al registrar movimiento",
    errorMethod: "REGISTRAR_MOVIMIENTO_MANUAL",
  });
}

/** v13.444.0 — Borrado de movimiento manual (soft-delete). */
export function useEliminarMovimientoManual() {
  return useMutationWithFeedback({
    mutationFn: (movId: string) => eliminarMovimientoManual(movId),
    invalidate: queryKeys.tesoreria.all,
    successTitle: "Movimiento eliminado",
    errorTitle: "Error al eliminar movimiento",
    errorMethod: "ELIMINAR_MOVIMIENTO_MANUAL",
  });
}
