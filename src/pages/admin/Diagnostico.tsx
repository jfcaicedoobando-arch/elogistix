/**
 * /admin/diagnostico — Visor de `app_logs` con filtros y paginación server-side.
 * Visible para super_admin (todos los logs) y admin de organización (sólo de su org)
 * gracias a las políticas RLS sobre la tabla.
 */
import { useState, useMemo } from "react";
import { Activity, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { useAppLogs, useAppLogsFnList, type AppLogLevel } from "@/hooks/admin/useAppLogs";
import { DiagnosticoFilters } from "@/components/admin/DiagnosticoFilters";
import { diagnosticoColumns } from "@/components/admin/diagnosticoColumns";
import { useDebounce } from "@/hooks/shared/useDebounce";

const DEFAULT_PAGE_SIZE = 50;

export default function Diagnostico() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [level, setLevel] = useState<AppLogLevel | "todos">("todos");
  const [fn, setFn] = useState<string | "todos">("todos");
  const [searchInput, setSearchInput] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const search = useDebounce(searchInput, 350);

  const { rows, total, totalPages, isLoading, isFetching, error } = useAppLogs({
    page,
    pageSize,
    level,
    fn,
    search,
    from,
    to,
  });

  const { data: fnOptions = [] } = useAppLogsFnList();

  const resetFilters = () => {
    setLevel("todos");
    setFn("todos");
    setSearchInput("");
    setFrom(null);
    setTo(null);
    setPage(1);
  };

  // Cualquier cambio de filtro debe resetear a la página 1
  const handleSetLevel = (v: AppLogLevel | "todos") => { setLevel(v); setPage(1); };
  const handleSetFn = (v: string) => { setFn(v); setPage(1); };
  const handleSetSearch = (v: string) => { setSearchInput(v); setPage(1); };
  const handleSetFrom = (v: string | null) => { setFrom(v); setPage(1); };
  const handleSetTo = (v: string | null) => { setTo(v); setPage(1); };

  const description = useMemo(() => {
    if (isLoading) return "Cargando registros…";
    return `${total.toLocaleString("es-MX")} registros — página ${page} de ${totalPages}${
      isFetching ? " (actualizando…)" : ""
    }`;
  }, [total, page, totalPages, isLoading, isFetching]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Activity className="h-6 w-6 text-primary" />}
        title="Diagnóstico"
        description={description}
      />

      <DiagnosticoFilters
        level={level}
        onLevelChange={handleSetLevel}
        fn={fn}
        onFnChange={handleSetFn}
        fnOptions={fnOptions}
        search={searchInput}
        onSearchChange={handleSetSearch}
        from={from}
        to={to}
        onFromChange={handleSetFrom}
        onToChange={handleSetTo}
        onReset={resetFilters}
      />

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <div>
            <p className="font-medium">No se pudieron cargar los registros</p>
            <p className="text-xs opacity-80">{error.message}</p>
          </div>
        </div>
      )}

      <div className="rounded-md border">
        <DataTable
          columns={diagnosticoColumns}
          data={rows}
          isLoading={isLoading}
          density="compact"
          emptyMessage="Sin registros para los filtros aplicados."
          rowKey={(r) => r.id}
          pagination={{
            page,
            totalPages,
            onPageChange: setPage,
            pageSize,
            onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
            pageSizeOptions: [25, 50, 100, 200],
          }}
        />
      </div>
    </div>
  );
}
