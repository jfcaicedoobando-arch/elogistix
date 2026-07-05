/**
 * Listado de tarifas del agente. Permite crear, editar (sólo borradores/rechazadas)
 * y duplicar (cualquier estado). La aprobación a 'vigente' la hace operaciones.
 * v13.172.17: migrado de `<Table>` crudo a `DataTable` (Fase 4 homologación).
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { useAgenteTarifas } from "@/features/portal-agente/hooks";
import { AgenteTarifaForm } from "@/features/portal-agente/components/AgenteTarifaForm";
import { Plus, MoreHorizontal } from "lucide-react";
import type { TarifaInput } from "@/features/costeo/services/tarifas";
import type { AgenteTarifaRow } from "@/features/portal-agente/services";

type Filter = "todas" | "borrador" | "vigente" | "rechazada";

interface EditorState {
  open: boolean;
  modo: "crear" | "editar" | "duplicar";
  tarifaId?: string;
  initial?: Partial<TarifaInput>;
}

function toInitial(t: AgenteTarifaRow): Partial<TarifaInput> {
  return {
    agente_id: "",
    naviera_id: t.naviera_id,
    ruta_id: t.ruta_id,
    tipo_contenedor_id: t.tipo_contenedor_id,
    flete_base: Number(t.flete_base),
    vigente_desde: t.vigente_desde,
    vigente_hasta: t.vigente_hasta,
    dias_libres_demoras: 7,
    recargos: [],
  };
}

export default function AgenteTarifas() {
  const { data: tarifas = [], isLoading } = useAgenteTarifas();
  const [filtro, setFiltro] = useState<Filter>("todas");
  const [editor, setEditor] = useState<EditorState>({ open: false, modo: "crear" });

  const filtradas = useMemo(
    () => filtro === "todas" ? tarifas : tarifas.filter((t) => t.estado_aprobacion === filtro),
    [tarifas, filtro],
  );

  const columns = useMemo<ColumnDef<AgenteTarifaRow, unknown>[]>(
    () => defineColumns<AgenteTarifaRow>([
      {
        id: "ruta",
        header: "Ruta",
        accessorFn: (t) => `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`,
        sortingFn: sortByString((t) => `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`),
        enableSorting: true,
        meta: { sticky: true, className: "text-sm" },
        cell: ({ row }) => (
          <div>
            <div>{row.original.puerto_origen_nombre} → {row.original.puerto_destino_nombre}</div>
            {row.original.estado_aprobacion === "rechazada" && row.original.motivo_rechazo && (
              <p className="text-xs text-destructive mt-1">
                <strong>Motivo:</strong> {row.original.motivo_rechazo}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "naviera",
        header: "Naviera",
        accessorFn: (t) => t.naviera_nombre,
        sortingFn: sortByString((t) => t.naviera_nombre),
        enableSorting: true,
        cell: ({ row }) => row.original.naviera_nombre,
      },
      {
        id: "contenedor",
        header: "Contenedor",
        accessorFn: (t) => t.tipo_contenedor_nombre,
        enableSorting: true,
        cell: ({ row }) => row.original.tipo_contenedor_nombre,
      },
      {
        id: "flete",
        header: "Flete base",
        accessorFn: (t) => Number(t.flete_base),
        sortingFn: sortByNumber((t) => Number(t.flete_base)),
        enableSorting: true,
        meta: { align: "right", className: "tabular-nums" },
        cell: ({ row }) =>
          `${row.original.moneda} ${Number(row.original.flete_base).toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
      },
      {
        id: "vigencia",
        header: "Vigencia",
        accessorFn: (t) => t.vigente_desde,
        sortingFn: sortByDate((t) => t.vigente_desde),
        enableSorting: true,
        meta: { className: "text-xs text-muted-foreground" },
        cell: ({ row }) => `${row.original.vigente_desde} → ${row.original.vigente_hasta}`,
      },
      {
        id: "estado",
        header: "Estado",
        accessorFn: (t) => t.estado_aprobacion,
        enableSorting: true,
        cell: ({ row }) => <EstadoBadge estado={row.original.estado_aprobacion} />,
      },
      {
        id: "acciones",
        header: "",
        meta: { width: "w-12", align: "right" },
        cell: ({ row }) => {
          const t = row.original;
          const editable = t.estado_aprobacion === "borrador" || t.estado_aprobacion === "rechazada";
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!editable}
                    onClick={() => setEditor({ open: true, modo: "editar", tarifaId: t.id, initial: toInitial(t) })}
                  >
                    {t.estado_aprobacion === "rechazada" ? "Corregir y reenviar" : "Editar"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => setEditor({ open: true, modo: "duplicar", initial: toInitial(t) })}
                  >
                    Duplicar como nueva
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ]),
    [],
  );

  return (
    <div className="space-y-4">
      <PageHeader
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
          <TabsTrigger value="vigente">Vigente ({tarifas.filter((t) => t.estado_aprobacion === "vigente").length})</TabsTrigger>
          <TabsTrigger value="rechazada">Rechazada ({tarifas.filter((t) => t.estado_aprobacion === "rechazada").length})</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <DataTable<AgenteTarifaRow>
          columns={columns}
          data={filtradas}
          rowKey={(t) => t.id}
          isLoading={isLoading}
          emptyMessage="No hay tarifas para este filtro."
        />
      </Card>

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

function EstadoBadge({ estado }: { estado: string }) {
  // Capitaliza estado ("vigente" → "Vigente") para casar con DOMAIN_STATUSES.tarifa_maritima.
  const canonical = estado.charAt(0).toUpperCase() + estado.slice(1);
  return <StatusBadge domain="tarifa_maritima" status={canonical} />;
}
