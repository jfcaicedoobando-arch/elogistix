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
 * Preserva `onSuccess`/`onError` extra del consumer (útil para navegación,
 * closes de modales, etc.). Los hooks callback se ejecutan DESPUÉS del feedback
 * por defecto.
 */
import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

export interface UseMutationWithFeedbackOptions<TData, TError, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "onSuccess" | "onError"> {
  /** Query keys a invalidar tras éxito. Array = múltiples invalidaciones. */
  invalidate?: QueryKey | QueryKey[];
  /** Título del toast de éxito. Si se omite, no se muestra toast success. */
  successTitle?: string;
  /** Descripción opcional del toast de éxito. */
  successDescription?: string;
  /** Título del toast de error. Default: "Error". */
  errorTitle?: string;
  /** Método reportado a observabilidad. Default: "ON_ERROR". */
  errorMethod?: string;
  /** Callback extra tras éxito (se ejecuta después del toast + invalidate). */
  onSuccess?: UseMutationOptions<TData, TError, TVariables, TContext>["onSuccess"];
  /** Callback extra tras error (se ejecuta después del toast). */
  onError?: UseMutationOptions<TData, TError, TVariables, TContext>["onError"];
}

function toKeyArray(k: QueryKey | QueryKey[] | undefined): QueryKey[] {
  if (!k) return [];
  // Un QueryKey es un readonly array; distinguimos "array de keys" cuando el
  // primer elemento es a su vez array.
  if (Array.isArray(k) && k.length > 0 && Array.isArray(k[0])) return k as QueryKey[];
  return [k as QueryKey];
}

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
    onSuccess: userOnSuccess,
    onError: userOnError,
    ...rest
  } = opts;

  return useMutation<TData, TError, TVariables, TContext>({
    ...rest,
    onSuccess: (data, variables, onMutateResult, context) => {
      for (const key of toKeyArray(invalidate)) {
        qc.invalidateQueries({ queryKey: key });
      }
      if (successTitle) {
        notifySuccess(undefined, { title: successTitle, description: successDescription });
      }
      userOnSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (error, variables, onMutateResult, context) => {
      // SAFE-CAST: react-query tipa el error como `unknown`; sólo usamos `.message` para el toast.
      const err = error as unknown as Error;
      notifyError(undefined, {
        title: errorTitle,
        description: err?.message,
        error,
        method: errorMethod,
        errorCode: ERROR_CODES.VALIDATION_FAILED,
      });
      userOnError?.(error, variables, onMutateResult, context);
    },
  });
}
