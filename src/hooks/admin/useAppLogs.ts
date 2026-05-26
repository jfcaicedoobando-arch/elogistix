/**
 * useAppLogs — Listado paginado de `public.app_logs` con filtros server-side.
 *
 * RLS controla el alcance: super_admin ve todos los registros, admin de
 * organización sólo los de su organización.
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchAppLogs, fetchAppLogsFnList, type AppLogLevel, type AppLogRow } from "@/services/admin";

export type { AppLogLevel, AppLogRow };

export interface AppLogsFilters {
  level: AppLogLevel | "todos";
  fn: string | "todos";
  search: string;
  from: string | null;
  to: string | null;
}

export interface UseAppLogsArgs extends AppLogsFilters {
  page: number;
  pageSize: number;
}

export interface UseAppLogsResult {
  rows: AppLogRow[];
  total: number;
  totalPages: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  refetch: () => void;
}

export function useAppLogs(args: UseAppLogsArgs): UseAppLogsResult {
  const { page, pageSize, level, fn, search, from, to } = args;

  const query = useQuery({
    queryKey: queryKeys.appLogs.list({ page, pageSize, level, fn, search, from, to }),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    queryFn: () => fetchAppLogs(args),
  });

  const total = query.data?.total ?? 0;
  return {
    rows: query.data?.rows ?? [],
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: (query.error as Error | null) ?? null,
    refetch: query.refetch,
  };
}

/** Lista distinct de `fn` para poblar el filtro. */
export function useAppLogsFnList() {
  return useQuery({
    queryKey: queryKeys.appLogs.fnList,
    staleTime: 60_000,
    queryFn: fetchAppLogsFnList,
  });
}
