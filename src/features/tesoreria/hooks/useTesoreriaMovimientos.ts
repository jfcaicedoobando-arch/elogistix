/**
 * Hooks de movimientos bancarios e conciliación.
 * Extraído de `index.ts` (Auditoría Paso 2: purga de barrels).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/contexts/AuthContext";
import {
  listarMovimientos, importarMovimientos, conciliarConPago, desconciliarMovimiento,
  ignorarMovimiento, sugerirCandidatos,
  type FiltrosMovimientos, type MovimientoBBVA,
} from "@/features/tesoreria/services";
import type { MovimientoParseado } from "@/features/tesoreria/domain/import/bbva";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";

export function useMovimientos(filtros: FiltrosMovimientos | null) {
  return useQuery({
    queryKey: queryKeys.tesoreria.movimientos(filtros?.cuenta_bancaria_id ?? null, filtros),
    queryFn: () => listarMovimientos(filtros!),
    enabled: !!filtros?.cuenta_bancaria_id,
    staleTime: 30_000,
  });
}

export function useImportarMovimientos() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ cuentaId, movimientos }: { cuentaId: string; movimientos: MovimientoParseado[] }) =>
      importarMovimientos(cuentaId, movimientos, user?.id ?? null),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, { title: `${vars.movimientos.length} movimientos importados` });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al importar movimientos: ${error.message}`, error, method: "IMPORT_MOVIMIENTOS" });
    },
  });
}

export function useSugerirCandidatos(mov: MovimientoBBVA | null) {
  return useQuery({
    queryKey: ["tesoreria", "candidatos", mov?.id],
    queryFn: () => sugerirCandidatos(mov!),
    enabled: !!mov,
    staleTime: 30_000,
  });
}

export function useConciliarPago() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (v: { movId: string; tipo: "cxc" | "cxp"; pagoId: string }) =>
      conciliarConPago(v.movId, v.tipo, v.pagoId, user?.id ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, { title: "Movimiento conciliado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al conciliar: ${error.message}`, error, method: "CONCILIAR_PAGO" });
    },
  });
}

export function useDesconciliar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movId: string) => desconciliarMovimiento(movId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, { title: "Movimiento desconciliado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al desconciliar: ${error.message}`, error, method: "DESCONCILIAR" });
    },
  });
}

export function useIgnorarMovimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ movId, motivo }: { movId: string; motivo: string }) =>
      ignorarMovimiento(movId, motivo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, { title: "Movimiento ignorado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al ignorar movimiento: ${error.message}`, error, method: "IGNORAR_MOVIMIENTO" });
    },
  });
}
