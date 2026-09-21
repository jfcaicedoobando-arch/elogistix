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
 */
import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { QueryKey } from "@tanstack/react-query";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

/** `MutationFunctionContext` oficial, derivado de los tipos instalados. */
export type MutationFnContext = Parameters<
  NonNullable<UseMutationOptions<unknown, Error, unknown, unknown>["onMutate"]>
>[1];

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

interface Snapshot {
  key: QueryKey;
  previous: unknown;
}

/**
 * Contexto interno del wrapper. Envuelve (no mezcla) el resultado del
 * `onMutate` del consumer para poder reenviárselo intacto y tipado a los
 * callbacks posteriores, sin necesidad de casts.
 */
interface WrapperContext<TContext> {
  snapshots: Snapshot[];
  userResult: TContext | undefined;
}

export interface UseMutationWithFeedbackOptions<TData, TError, TVariables, TContext>
  extends Omit<
    UseMutationOptions<TData, TError, TVariables, TContext>,
    "onSuccess" | "onError" | "onMutate" | "onSettled"
  > {
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
  /** Callback extra tras onMutate del wrapper; su retorno viaja a los demás. */
  onMutate?: (
    variables: TVariables,
    context: MutationFnContext,
  ) => Promise<TContext> | TContext;
  /** Callback extra tras éxito (se ejecuta después del toast + invalidate). */
  onSuccess?: (
    data: TData,
    variables: TVariables,
    onMutateResult: TContext | undefined,
    context: MutationFnContext,
  ) => void;
  /** Callback extra tras error (se ejecuta después del toast + rollback). */
  onError?: (
    error: TError,
    variables: TVariables,
    onMutateResult: TContext | undefined,
    context: MutationFnContext,
  ) => void;
  /** Callback extra al finalizar (después de revalidar las queries optimistas). */
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    onMutateResult: TContext | undefined,
    context: MutationFnContext,
  ) => void;
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
  return typeof key === "function" ? key(variables) : key;
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
