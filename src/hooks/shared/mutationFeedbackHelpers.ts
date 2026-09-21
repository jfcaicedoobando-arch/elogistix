/**
 * Helpers puros de `useMutationWithFeedback`: normalización de query keys y de
 * descriptores optimistas. Sin React ni side-effects (uso interno del hook).
 */
import type { QueryKey } from "@tanstack/react-query";
import type { OptimisticUpdate } from "./mutationFeedbackTypes";

export function toKeyArray(k: QueryKey | QueryKey[] | undefined): QueryKey[] {
  if (!k) return [];
  // Un QueryKey es un readonly array; distinguimos "array de keys" cuando el
  // primer elemento es a su vez array.
  if (Array.isArray(k) && k.length > 0 && Array.isArray(k[0])) return k as QueryKey[];
  return [k as QueryKey];
}

export function toOptimisticArray<TVariables>(
  o: OptimisticUpdate<TVariables> | OptimisticUpdate<TVariables>[] | undefined,
): OptimisticUpdate<TVariables>[] {
  if (!o) return [];
  return Array.isArray(o) ? o : [o];
}

export function resolveKey<TVariables>(
  key: QueryKey | ((variables: TVariables) => QueryKey),
  variables: TVariables,
): QueryKey {
  return typeof key === "function" ? key(variables) : key;
}
