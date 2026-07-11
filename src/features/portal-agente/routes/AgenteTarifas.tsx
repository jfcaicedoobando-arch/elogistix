/**
 * Listado de tarifas del agente. Permite crear, editar (sólo borradores/rechazadas)
 * y duplicar (cualquier estado). La aprobación a 'vigente' la hace operaciones.
 * v13.172.17: migrado de `<Table>` crudo a `DataTable` (Fase 4 homologación).
 * v13.182.0: columnas + `EstadoBadge` extraídos a `_sections/agenteTarifasColumns.tsx`.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { useAgenteTarifas } from "@/features/portal-agente/hooks";
import { AgenteTarifaForm } from "@/features/portal-agente/components/AgenteTarifaForm";
import { Plus, FileSpreadsheet } from "lucide-react";
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import type { AgenteTarifaRow } from "@/features/portal-agente/services";
import {
  buildAgenteTarifasColumns,
  toInitial,
} from "./_sections/agenteTarifasColumns";

type Filter = "todas" | "borrador" | "vigente" | "rechazada";

interface EditorState {
  open: boolean;
  modo: "crear" | "editar" | "duplicar";
  tarifaId?: string;
  initial?: Partial<TarifaInput>;
}

export default function AgenteTarifas() {
  const { data: tarifas = [], isLoading } = useAgenteTarifas();
  const [filtro, setFiltro] = useState<Filter>("todas");
  const [editor, setEditor] = useState<EditorState>({ open: false, modo: "crear" });

  const filtradas = useMemo(
    () => filtro === "todas" ? tarifas : tarifas.filter((t) => t.estado_aprobacion === filtro),
    [tarifas, filtro],
  );

  const columns = useMemo(
    () => buildAgenteTarifasColumns({
      onEditar: (t) => setEditor({ open: true, modo: "editar", tarifaId: t.id, initial: toInitial(t) }),
      onDuplicar: (t) => setEditor({ open: true, modo: "duplicar", initial: toInitial(t) }),
    }),
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={<FileSpreadsheet className="h-6 w-6 text-accent" />}
        title="Mis Tarifas Marítimas"
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
          <TabsTrigger value="vigente">Vigente ({tarifas.filter((t) => t.estado_aprobacion === "vigente").length})</TabsTrigger>
          <TabsTrigger value="rechazada">Rechazada ({tarifas.filter((t) => t.estado_aprobacion === "rechazada").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable<AgenteTarifaRow>
        columns={columns}
        data={filtradas}
        rowKey={(t) => t.id}
        isLoading={isLoading}
        emptyMessage="No hay tarifas para este filtro."
      />


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
