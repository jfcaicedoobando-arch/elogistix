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
 * Preserva `onSuccess`/`onError` extra del consumer (útil para navegación,
 * closes de modales, etc.). Los hooks callback se ejecutan DESPUÉS del feedback
 * por defecto.
 */
import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/components/shared/utils/appFeedback";
import { ERROR_CODES } from "@/lib/domain/errorCatalog";

/**
 * Descriptor de actualización optimista. Soporta 1..N queries: se toma un
 * snapshot de cada una, se aplica el updater, y si la mutación falla se
 * restauran a su valor previo (rollback). Tras `settled` se invalida.
 */
export interface OptimisticUpdate<TVariables, TData = unknown> {
  /** QueryKey (o función que la deriva de las variables) a actualizar. */
  queryKey: QueryKey | ((variables: TVariables) => QueryKey);
  /**
   * Función pura que recibe el valor cacheado actual y las variables, y
   * devuelve el nuevo valor cacheado. Si `old` es undefined, típicamente
   * se retorna undefined (nada que optimizar).
   */
  updater: (old: TData | undefined, variables: TVariables) => TData | undefined;
}

/** Contexto interno inyectado por el wrapper cuando hay optimismo. */
interface OptimisticContext {
  __snapshots?: Array<{ key: QueryKey; previous: unknown }>;
}

export interface UseMutationWithFeedbackOptions<TData, TError, TVariables, TContext>
  extends Omit<UseMutationOptions<TData, TError, TVariables, TContext>, "onSuccess" | "onError" | "onMutate"> {
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
  /**
   * Actualización(es) optimista(s). Puede ser un descriptor único o un array
   * para tocar varias queries al vuelo (ej. detalle + lista). El rollback y
   * la invalidación final las orquesta el wrapper.
   */
  optimistic?: OptimisticUpdate<TVariables> | OptimisticUpdate<TVariables>[];
  /**
   * Si es true, suprime ambos toasts (éxito y error). Útil cuando el caller
   * maneja las notificaciones (ej. clasificar errores docs_faltantes).
   * El rollback optimista y las invalidaciones siguen funcionando.
   */
  silent?: boolean;
  /** Callback extra tras éxito (se ejecuta después del toast + invalidate). */
  onSuccess?: UseMutationOptions<TData, TError, TVariables, TContext>["onSuccess"];
  /** Callback extra tras error (se ejecuta después del toast + rollback). */
  onError?: UseMutationOptions<TData, TError, TVariables, TContext>["onError"];
  /** Callback extra tras onMutate del usuario (se ejecuta antes del optimista). */
  onMutate?: UseMutationOptions<TData, TError, TVariables, TContext>["onMutate"];
}

function toKeyArray(k: QueryKey | QueryKey[] | undefined): QueryKey[] {
  if (!k) return [];
  // Un QueryKey es un readonly array; distinguimos "array de keys" cuando el
  // primer elemento es a su vez array.
  if (Array.isArray(k) && k.length > 0 && Array.isArray(k[0])) return k as QueryKey[];
  return [k as QueryKey];
}

function toOptimisticArray<TVariables>(
  o: OptimisticUpdate<TVariables> | OptimisticUpdate<TVariables>[] | undefined,
): OptimisticUpdate<TVariables>[] {
  if (!o) return [];
  return Array.isArray(o) ? o : [o];
}

function resolveKey<TVariables>(
  key: QueryKey | ((variables: TVariables) => QueryKey),
  variables: TVariables,
): QueryKey {
  return typeof key === "function" ? (key as (v: TVariables) => QueryKey)(variables) : key;
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
    optimistic,
    onSuccess: userOnSuccess,
    onError: userOnError,
    onMutate: userOnMutate,
    ...rest
  } = opts;

  return useMutation<TData, TError, TVariables, TContext>({
    ...rest,
    onMutate: async (variables) => {
      const updates = toOptimisticArray(optimistic);
      const snapshots: Array<{ key: QueryKey; previous: unknown }> = [];

      for (const u of updates) {
        const key = resolveKey(u.queryKey, variables);
        // Cancelar refetches en vuelo para que no pisen nuestra escritura optimista.
        await qc.cancelQueries({ queryKey: key });
        const previous = qc.getQueryData(key);
        snapshots.push({ key, previous });
        qc.setQueryData(key, (old: TData | undefined) => u.updater(old, variables));
      }

      // Combinamos el contexto del usuario con nuestros snapshots.
      // SAFE-CAST: la firma tipada exige (vars, mutation) pero sólo necesitamos vars.
      const userCtx = (await (userOnMutate as unknown as (v: TVariables) => unknown)?.(variables)) as unknown;
      const merged: OptimisticContext & Record<string, unknown> = {
        ...(userCtx && typeof userCtx === "object" ? (userCtx as Record<string, unknown>) : {}),
        __snapshots: snapshots,
      };
      return merged as unknown as TContext;
    },
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
      // Rollback: restauramos cada snapshot capturado en onMutate.
      const ctx = onMutateResult as unknown as OptimisticContext | undefined;
      const snapshots = ctx?.__snapshots ?? [];
      for (const snap of snapshots) {
        qc.setQueryData(snap.key, snap.previous);
      }

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
    onSettled: (data, error, variables, onMutateResult) => {
      // Tras el resultado real, revalidamos las queries optimistas para que
      // reflejen el estado servidor autoritativo.
      if (optimistic) {
        const updates = toOptimisticArray(optimistic);
        for (const u of updates) {
          const key = resolveKey(u.queryKey, variables);
          qc.invalidateQueries({ queryKey: key });
        }
      }
      // Delegamos al onSettled del usuario si lo pasó vía `...rest`.
      // SAFE-CAST: la firma tipada exige un 5° arg (mutation), no lo propagamos.
      (rest.onSettled as unknown as ((d: TData | undefined, e: TError | null, v: TVariables, c: TContext | undefined) => void) | undefined)?.(data, error, variables, onMutateResult);
    },
  });
}
