/**
 * /admin/diagnostico — Visor de `app_logs` con filtros y paginación server-side.
 */
import { useState, useMemo } from "react";
import { Activity } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { VirtualDataTable } from "@/components/shared/VirtualDataTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppLogs, useAppLogsFnList, type AppLogLevel } from "@/features/admin/hooks";
import { DiagnosticoFilters } from "@/features/admin/components/DiagnosticoFilters";
import { DiagnosticoHealthPanel } from "@/features/admin/components/DiagnosticoHealthPanel";
import AlertasSistemaPanel from "@/features/admin/components/AlertasSistemaPanel";
import { diagnosticoColumns } from "@/features/admin/components/DiagnosticoColumns";
import { useDebounce, useDocumentTitle } from "@/hooks/shared";
import { formatNumber } from "@/lib/formatters";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

const DIAGNOSTICO_PAGE_SIZE = 50;

export default function Diagnostico() {
  useDocumentTitle('Diagnóstico');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DIAGNOSTICO_PAGE_SIZE);
  const [level, setLevel] = useState<AppLogLevel | "todos">("todos");
  const [fn, setFn] = useState<string | "todos">("todos");
  const [searchInput, setSearchInput] = useState("");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  const search = useDebounce(searchInput, 350);

  const { rows, total, totalPages, isLoading, isFetching, error, refetch } = useAppLogs({
    page, pageSize, level, fn, search, from, to,
  });

  const { data: fnOptions = [] } = useAppLogsFnList();

  const resetFilters = () => {
    setLevel("todos"); setFn("todos"); setSearchInput("");
    setFrom(null); setTo(null); setPage(1);
  };

  const handleSetLevel = (v: AppLogLevel | "todos") => { setLevel(v); setPage(1); };
  const handleSetFn = (v: string) => { setFn(v); setPage(1); };
  const handleSetSearch = (v: string) => { setSearchInput(v); setPage(1); };
  const handleSetFrom = (v: string | null) => { setFrom(v); setPage(1); };
  const handleSetTo = (v: string | null) => { setTo(v); setPage(1); };

  const description = useMemo(() => {
    if (isLoading) return "Cargando registros…";
    return `${formatNumber(total)} registros — página ${page} de ${totalPages}${
      isFetching ? " (actualizando…)" : ""
    }`;
  }, [total, page, totalPages, isLoading, isFetching]);

  return (
    <PageContainer>
      <PageHeader
        icon={<Activity className="h-6 w-6 text-primary" />}
        title="Diagnóstico"
        description={description}
      />

      <Tabs defaultValue="salud" className="space-y-4">
        <TabsList>
          <TabsTrigger value="salud">Salud</TabsTrigger>
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="bitacora">Bitácora</TabsTrigger>
        </TabsList>

        <TabsContent value="salud" className="space-y-4">
          <DiagnosticoHealthPanel />
        </TabsContent>

        <TabsContent value="alertas" className="space-y-4">
          <AlertasSistemaPanel />
        </TabsContent>

        <TabsContent value="bitacora" className="space-y-4">
          <DiagnosticoFilters
            level={level} onLevelChange={handleSetLevel}
            fn={fn} onFnChange={handleSetFn}
            fnOptions={fnOptions}
            search={searchInput} onSearchChange={handleSetSearch}
            from={from} to={to}
            onFromChange={handleSetFrom} onToChange={handleSetTo}
            onReset={resetFilters}
          />

          {error && (
            <ErrorState
              title="No se pudieron cargar los registros"
              description={error.message}
              onRetry={() => refetch()}
            />
          )}

          <VirtualDataTable
            columns={diagnosticoColumns}
            data={rows}
            isLoading={isLoading}
            density={TABLE_DENSITY.embebida}
            emptyMessage="Sin registros para los filtros aplicados."
            rowKey={(r) => r.id}
            estimateRowHeight={56}
            maxHeight={640}
            overscan={12}
            pagination={{
              page, totalPages, onPageChange: setPage,
              pageSize,
              onPageSizeChange: (s) => { setPageSize(s); setPage(1); },
              pageSizeOptions: [25, 50, 100, 200, 500],
            }}
          />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
