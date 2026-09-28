/**
 * Listado de tarifas del agente. Permite crear, editar (sólo borradores/rechazadas)
 * y duplicar (cualquier estado). La aprobación a 'vigente' la hace operaciones.
 * v13.172.17: migrado de `<Table>` crudo a `DataTable` (Fase 4 homologación).
 * v13.182.0: columnas + `EstadoBadge` extraídos a `_sections/agenteTarifasColumns.tsx`.
 */
import { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { useAgenteTarifas } from "@/features/portal-agente/hooks";
import { AgenteTarifaForm } from "@/features/portal-agente/components/AgenteTarifaForm";
import { Plus, FileSpreadsheet } from "lucide-react";
import type { TarifaInput, TarifaRecargoInput } from "@/features/costeo/services/tarifas";
import { fetchRecargosDeTarifa } from "@/features/costeo/services/topTarifas";
import type { AgenteTarifaRow } from "@/features/portal-agente/services";
import {
  buildAgenteTarifasColumns,
  toInitial,
} from "./_sections/agenteTarifasColumns";
import { AgenteTarifaCard } from "./_sections/AgenteTarifaCard";
import { todayLocalISO } from "@/lib/date/today";
import { ErrorState } from "@/components/shared/states/ErrorState";
import { esTarifaUsableEn } from "@/features/costeo";
import { notifyError } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

type Filter = "todas" | "borrador" | "vigente" | "rechazada";

/**
 * Misma vigencia de negocio que el catálogo: aprobada y dentro de inicio/fin.
 */
const esVigenteReal = esTarifaUsableEn;

interface EditorState {
  open: boolean;
  modo: "crear" | "editar" | "duplicar";
  tarifaId?: string;
  initial?: Partial<TarifaInput>;
}

function recargosIniciales(
  rows: Awaited<ReturnType<typeof fetchRecargosDeTarifa>>,
  conservarId: boolean,
): TarifaRecargoInput[] {
  return rows.map((r) => ({
    ...(conservarId ? { id: r.id } : {}),
    concepto: r.concepto,
    lado: r.lado === "origen" || r.lado === "destino" ? r.lado : undefined,
    monto: Number(r.monto),
    moneda: r.moneda ?? "USD",
    incluido_en_total: r.incluido_en_total ?? true,
  }));
}

export default function AgenteTarifas() {
  const { data: tarifas = [], isLoading, isError, refetch } = useAgenteTarifas();
  const [filtro, setFiltro] = useState<Filter>("todas");
  const [editor, setEditor] = useState<EditorState>({ open: false, modo: "crear" });

  // Las programadas y reemplazadas siguen visibles en "Todas", no en vigentes.
  const hoy = todayLocalISO();

  const filtradas = useMemo(() => {
    if (filtro === "todas") return tarifas;
    if (filtro === "vigente") return tarifas.filter((t) => esVigenteReal(t, hoy));
    return tarifas.filter((t) => t.estado_aprobacion === filtro);
  }, [tarifas, filtro, hoy]);

  const handleEditar = useCallback(async (t: AgenteTarifaRow) => {
    try {
      const rows = await fetchRecargosDeTarifa(t.id);
      setEditor({ open: true, modo: "editar", tarifaId: t.id, initial: toInitial(t, recargosIniciales(rows, true)) });
    } catch (error: unknown) {
      notifyError(undefined, {
        title: "No se pudo abrir la tarifa para editar",
        description: getErrorMessage(error), error, method: "AGENTE_EDITAR_TARIFA",
      });
    }
  }, []);

  // B-086: antes de abrir el form de duplicar se traen los recargos reales de
  // la tarifa (BAF/LSS/ISPS...) — la "nueva versión" debe ser fiel. Si la
  // carga falla, se abre sin recargos (comportamiento anterior).
  const handleDuplicar = useCallback(async (t: AgenteTarifaRow) => {
    let recargos: TarifaRecargoInput[] = [];
    try {
      const rows = await fetchRecargosDeTarifa(t.id);
      recargos = recargosIniciales(rows, false);
    } catch { /* silencioso: el usuario puede recapturar recargos a mano */ }
    setEditor({ open: true, modo: "duplicar", initial: toInitial(t, recargos) });
  }, []);

  const columns = useMemo(
    () => buildAgenteTarifasColumns({
      onEditar: (t) => { void handleEditar(t); },
      onDuplicar: (t) => { void handleDuplicar(t); },
    }),
    [handleDuplicar, handleEditar],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<FileSpreadsheet className="h-6 w-6 text-accent" />}
        title="Mis tarifas marítimas"
        description="Tarifas que has subido para tus rutas marítimas. Las nuevas tarifas quedan en borrador hasta que operaciones las aprueba."
        actions={
          <Button onClick={() => setEditor({ open: true, modo: "crear" })}>
            <Plus className="h-4 w-4 mr-1" /> Nueva tarifa
          </Button>
        }
      />

      <Card className="p-3">
        <p className="text-xs text-muted-foreground">
          <strong>¿Cómo funciona?</strong> Captura o actualiza una tarifa y queda en <em>borrador</em>.
          Operaciones la revisa y la pasa a <em>vigente</em> — entonces aparece como opción en las
          cotizaciones que envían los vendedores. Si la <em>rechazan</em>, edítala y vuelve a guardarla.
          Las tarifas <em>vigentes</em> no se pueden editar: usa <strong>Duplicar</strong> para crear una versión nueva.
        </p>
      </Card>

      <Tabs value={filtro} onValueChange={(v) => setFiltro(v as Filter)}>
        <TabsList>
          <TabsTrigger value="todas">Todas ({tarifas.length})</TabsTrigger>
          <TabsTrigger value="borrador">Borrador ({tarifas.filter((t) => t.estado_aprobacion === "borrador").length})</TabsTrigger>
          <TabsTrigger value="vigente">Vigente ({tarifas.filter((t) => esVigenteReal(t, hoy)).length})</TabsTrigger>
          <TabsTrigger value="rechazada">Rechazada ({tarifas.filter((t) => t.estado_aprobacion === "rechazada").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {isError ? (
        <ErrorState onRetry={() => void refetch()} />
      ) : (
      <ResponsiveDataTable<AgenteTarifaRow>
        columns={columns}
        data={filtradas}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        emptyMessage="No hay tarifas para este filtro."
        mobileCard={(t) => (
          <AgenteTarifaCard
            t={t}
            onEditar={(x) => { void handleEditar(x); }}
            onDuplicar={(x) => { void handleDuplicar(x); }}
          />
        )}
      />
      )}


      <AgenteTarifaForm
        open={editor.open}
        onOpenChange={(o) => setEditor((s) => ({ ...s, open: o }))}
        modo={editor.modo}
        tarifaId={editor.tarifaId}
        initial={editor.initial}
      />
    </div>
  );
}
