/**
 * Hooks de cuentas bancarias y saldos de tesorería.
 * Extraído de `index.ts` (Auditoría Paso 2: purga de barrels).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/contexts/AuthContext";
import {
  listarCuentas, crearCuenta, eliminarCuenta, fetchSaldosCuentas,
} from "@/features/tesoreria/services";
import type { TablesInsert } from "@/integrations/supabase/types";

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

export function useEliminarCuenta() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => eliminarCuenta(id, user?.id ?? null),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all }),
  });
}

/** Saldos por cuenta (sin lectura de facturas). Reutilizable. */
export function useSaldosCuentas() {
  return useQuery({
    queryKey: ["tesoreria", "saldos-cuentas"] as const,
    queryFn: fetchSaldosCuentas,
    staleTime: 60_000,
  });
}
