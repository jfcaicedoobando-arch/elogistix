/**
 * useAppLogs — Listado paginado de `public.app_logs` con filtros server-side.
 *
 * RLS controla el alcance: super_admin ve todos los registros, admin de
 * organización sólo los de su organización. Aquí sólo aplicamos los filtros
 * declarados por el usuario y dejamos que Supabase resuelva el resto.
 */
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppLogLevel = "info" | "warn" | "error";
export type AppLogRow = Database["public"]["Tables"]["app_logs"]["Row"];

export interface AppLogsFilters {
  level: AppLogLevel | "todos";
  fn: string | "todos";
  search: string;
  from: string | null; // ISO date (yyyy-MM-dd)
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
    queryKey: ["app_logs", { page, pageSize, level, fn, search, from, to }],
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    queryFn: async () => {
      let q = supabase
        .from("app_logs")
        .select("*", { count: "exact" })
        .order("ts", { ascending: false });

      if (level !== "todos") q = q.eq("level", level);
      if (fn !== "todos") q = q.eq("fn", fn);
      if (search.trim()) q = q.ilike("msg", `%${search.trim()}%`);
      if (from) q = q.gte("ts", `${from}T00:00:00.000Z`);
      if (to) q = q.lte("ts", `${to}T23:59:59.999Z`);

      const fromIdx = (page - 1) * pageSize;
      const toIdx = fromIdx + pageSize - 1;
      q = q.range(fromIdx, toIdx);

      const { data, error, count } = await q;
      if (error) throw new Error(error.message);
      return { rows: (data ?? []) as AppLogRow[], total: count ?? 0 };
    },
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

/**
 * Hook auxiliar: lista distinct de `fn` para poblar el filtro. Usa una query
 * pequeña con límite alto y deduplica en cliente — suficiente para el volumen
 * esperado (decenas de funciones).
 */
export function useAppLogsFnList() {
  return useQuery({
    queryKey: ["app_logs", "fn_list"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_logs")
        .select("fn")
        .order("fn", { ascending: true })
        .limit(1000);
      if (error) throw new Error(error.message);
      const set = new Set<string>();
      (data ?? []).forEach((r) => set.add(r.fn));
      return Array.from(set).sort();
    },
  });
}
