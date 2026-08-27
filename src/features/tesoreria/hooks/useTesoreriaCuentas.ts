/**
 * Hooks de cuentas bancarias y saldos de tesorería.
 * Extraído de `index.ts` (Auditoría Paso 2: purga de barrels).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useOrgFilter } from "@/hooks/shared";
import {
  listarCuentas, crearCuenta, actualizarCuenta, eliminarCuenta, fetchSaldosCuentas,
  cuentaTieneMovimientos,
} from "@/features/tesoreria/services";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

export function useCuentasBancarias(activas = true) {
  return useQuery({
    queryKey: queryKeys.tesoreria.cuentas(activas),
    queryFn: () => listarCuentas(activas),
    staleTime: 60_000,
  });
}

export function useCrearCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: TablesInsert<"cuentas_bancarias">) => crearCuenta(p),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, { title: "Cuenta bancaria creada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo crear cuenta", description: getErrorMessage(error), error, method: "CREATE_CUENTA_BANCARIA" });
    },
  });
}

export function useActualizarCuenta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      id: string;
      patch: TablesUpdate<"cuentas_bancarias">;
      /** H5: sello de versión leído al abrir el formulario. */
      expectedUpdatedAt?: string | null;
    }) => actualizarCuenta(vars.id, vars.patch, vars.expectedUpdatedAt),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, { title: "Cuenta bancaria actualizada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo actualizar la cuenta", description: getErrorMessage(error), error, method: "UPDATE_CUENTA_BANCARIA" });
    },
  });
}

/** Indica si la cuenta ya tiene movimientos (bloquea el cambio de moneda). */
export function useTieneMovimientosCuenta(cuentaId: string | null) {
  return useQuery({
    queryKey: [...queryKeys.tesoreria.all, "tiene-movimientos", cuentaId],
    queryFn: () => cuentaTieneMovimientos(cuentaId as string),
    enabled: !!cuentaId,
    staleTime: 60_000,
  });
}

export function useEliminarCuenta() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => eliminarCuenta(id, user?.id ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tesoreria.all });
      notifySuccess(undefined, { title: "Cuenta bancaria eliminada" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo eliminar cuenta", description: getErrorMessage(error), error, method: "DELETE_CUENTA_BANCARIA" });
    },
  });
}

/** Saldos por cuenta (sin lectura de facturas). Filtra por tenant activo. */
export function useSaldosCuentas() {
  const { organizationId } = useOrgFilter();
  return useQuery({
    queryKey: queryKeys.tesoreria.saldosCuentasPorOrg(organizationId ?? null),
    queryFn: () => fetchSaldosCuentas(organizationId ?? null),
    enabled: !!organizationId,
    staleTime: 60_000,
  });
}
