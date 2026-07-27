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
  ignorarMovimiento, sugerirCandidatos,
  type FiltrosMovimientos, type MovimientoBBVA,
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
