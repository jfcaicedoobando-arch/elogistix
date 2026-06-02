import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/contexts/AuthContext";
import {
  listarCuentas, crearCuenta, actualizarCuenta, eliminarCuenta,
  listarMovimientos, importarMovimientos, conciliarConPago, desconciliarMovimiento,
  ignorarMovimiento, sugerirCandidatos,
  fetchResumenTesoreria,
  type FiltrosMovimientos, type MovimientoBBVA,
} from "@/services/tesoreria";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import type { MovimientoParseado } from "@/lib/import/bbva";

export function useCuentasBancarias(activas = true) {
  return useQuery({
    queryKey: [...queryKeys.tesoreria.cuentas, activas],
    queryFn: () => listarCuentas(activas),
    staleTime: 60_000,
  });
}

export function useCrearCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: TablesInsert<"cuentas_bancarias">) => crearCuenta(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all }),
  });
}

export function useActualizarCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TablesUpdate<"cuentas_bancarias"> }) =>
      actualizarCuenta(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all }),
  });
}

export function useEliminarCuenta() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => eliminarCuenta(id, user?.id ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all }),
  });
}

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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all }),
  });
}

export function useDesconciliar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (movId: string) => desconciliarMovimiento(movId),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all }),
  });
}

export function useIgnorarMovimiento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ movId, motivo }: { movId: string; motivo: string }) =>
      ignorarMovimiento(movId, motivo),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all }),
  });
}

export function useResumenTesoreria() {
  return useQuery({
    queryKey: queryKeys.tesoreria.resumen(),
    queryFn: fetchResumenTesoreria,
    staleTime: 60_000,
  });
}

export { useFlujoProyectado } from "./useFlujoProyectado";
