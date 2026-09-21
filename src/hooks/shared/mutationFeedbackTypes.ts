/**
 * Tipos del wrapper `useMutationWithFeedback`.
 *
 * Extraídos del hook (Power of 10 #1: archivos ≤ 200 líneas). Conservan el
 * contrato COMPLETO de TanStack Query v5: `MutationFunctionContext`, variables,
 * resultado de `onMutate` y callbacks completos.
 */
import type { QueryKey, UseMutationOptions } from "@tanstack/react-query";

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

/** Snapshot interno de una query antes de la escritura optimista. */
export interface Snapshot {
  key: QueryKey;
  previous: unknown;
}

/**
 * Contexto interno del wrapper. Envuelve (no mezcla) el resultado del
 * `onMutate` del consumer para poder reenviárselo intacto y tipado a los
 * callbacks posteriores, sin necesidad de casts.
 */
export interface WrapperContext<TContext> {
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
