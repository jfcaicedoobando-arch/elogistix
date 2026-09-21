/**
 * useMutationWithFeedback — wrapper delgado sobre `useMutation` que estandariza
 * el patrón repetido en >30 hooks: invalidar queries + `notifySuccess`/`notifyError`.
 *
 * Analogía: en vez de escribir "recibo la orden → confirmo → aviso en cocina"
 * en cada mesero, tenemos un mesero base y solo cambiamos el platillo.
 *
 * Uso mínimo:
 *   const m = useMutationWithFeedback({
 *     mutationFn: (input) => createX(input),
 *     invalidate: queryKeys.x.all,
 *     successTitle: "X creado",
 *     errorTitle: "Error al crear X",
 *   });
 *
 * Uso optimista (Fase 3 TanStack):
 *   const m = useMutationWithFeedback({
 *     mutationFn: ({ id, estado }) => svcUpdate(id, estado),
 *     invalidate: queryKeys.embarques.all,
 *     optimistic: {
 *       queryKey: (vars) => queryKeys.embarques.detail(vars.id),
 *       updater: (old, vars) => ({ ...old, estado: vars.estado }),
 *     },
 *   });
 *
 * Preserva `onMutate`/`onSuccess`/`onError`/`onSettled` del consumer con el
 * contrato COMPLETO de TanStack Query v5 (incluido el `MutationFunctionContext`
 * y el resultado de `onMutate`). Los callbacks del consumer se ejecutan DESPUÉS
 * del feedback/invalidación. P1-C: sin casts `as`/`unknown`.
 *
 * Tipos en `mutationFeedbackTypes.ts`; helpers puros en
 * `mutationFeedbackHelpers.ts` (Power of 10 #1: ≤ 200 líneas por archivo).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";
import {
  toKeyArray,
  toOptimisticArray,
  resolveKey,
} from "./mutationFeedbackHelpers";
import type {
  Snapshot,
  WrapperContext,
  UseMutationWithFeedbackOptions,
} from "./mutationFeedbackTypes";

// API pública preexistente del módulo.
export type {
  MutationFnContext,
  OptimisticUpdate,
  UseMutationWithFeedbackOptions,
} from "./mutationFeedbackTypes";

export function useMutationWithFeedback<TData = unknown, TError = Error, TVariables = void, TContext = unknown>(
  opts: UseMutationWithFeedbackOptions<TData, TError, TVariables, TContext>,
) {
  const qc = useQueryClient();
  const {
    invalidate,
    successTitle,
    successDescription,
    errorTitle = "Error",
    errorMethod = "ON_ERROR",
    optimistic,
    silent = false,
    onSuccess: userOnSuccess,
    onError: userOnError,
    onMutate: userOnMutate,
    onSettled: userOnSettled,
    ...rest
  } = opts;

  return useMutation<TData, TError, TVariables, WrapperContext<TContext>>({
    ...rest,
    onMutate: async (variables, context) => {
      const snapshots: Snapshot[] = [];

      for (const u of toOptimisticArray(optimistic)) {
        const key = resolveKey(u.queryKey, variables);
        // Cancelar refetches en vuelo para que no pisen nuestra escritura optimista.
        await qc.cancelQueries({ queryKey: key });
        snapshots.push({ key, previous: qc.getQueryData(key) });
        qc.setQueryData(key, (old: unknown) => u.updater(old, variables));
      }

      const userResult = await userOnMutate?.(variables, context);
      return { snapshots, userResult };
    },
    onSuccess: (data, variables, onMutateResult, context) => {
      for (const key of toKeyArray(invalidate)) {
        qc.invalidateQueries({ queryKey: key });
      }
      if (successTitle && !silent) {
        notifySuccess(undefined, { title: successTitle, description: successDescription });
      }
      userOnSuccess?.(data, variables, onMutateResult?.userResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      for (const snap of onMutateResult?.snapshots ?? []) {
        qc.setQueryData(snap.key, snap.previous);
      }
      // FIX-R2-03: traducimos códigos `LC_*` en UN solo punto (getErrorMessage).
      // FIX-R3 (frontend_hunter P3): sin errorCode fijo — antes VALIDATION_FAILED
      // compartía el toast id entre todas las mutations y etiquetaba mal el
      // reporte; ahora el id sale de `errorMethod` y el código de la causa real.
      if (!silent) {
        notifyError(undefined, {
          title: errorTitle,
          description: getErrorMessage(error),
          error,
          method: errorMethod,
        });
      }
      userOnError?.(error, variables, onMutateResult?.userResult, context);
    },
    onSettled: (data, error, variables, onMutateResult, context) => {
      // Tras el resultado real, revalidamos las queries optimistas para que
      // reflejen el estado servidor autoritativo.
      for (const u of toOptimisticArray(optimistic)) {
        qc.invalidateQueries({ queryKey: resolveKey(u.queryKey, variables) });
      }
      userOnSettled?.(data, error, variables, onMutateResult?.userResult, context);
    },
  });
}
