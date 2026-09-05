import { StatusBadge } from "@/components/shared/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase } from "@/lib/formatters";
import { useActualizarLead, type CrmLeadEstado, type CrmLeadRow } from "@/features/crm/hooks";
import { LEAD_ESTADOS_ETAPA_LEAD, esProspecto } from "@/features/crm/domain/leads/etapas";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

function EstadoCell({ lead, puedeGestionar }: { lead: CrmLeadRow; puedeGestionar: boolean }) {
  const actualizar = useActualizarLead();
  // Rediseño CRM: prospectos y convertidos ya no cambian de etapa desde la tabla.
  // v13.823.60: quien no puede gestionar ESA fila ve badge, no selector.
  if (!puedeGestionar || lead.estado === "Convertido" || esProspecto(lead.estado)) {
    // v13.681.0 · UI-1: color unificado por el statusRegistry (dominio lead).
    return <StatusBadge domain="lead" status={lead.estado} />;
  }
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={lead.estado}
        onValueChange={async (v) => {
          if (v === lead.estado) return;
          // v13.823.100: useActualizarLead ya notifica el error; no duplicar feedback aqui.
          await actualizar.mutateAsync({ id: lead.id, patch: { estado: v as CrmLeadEstado } }).catch(() => undefined);
        }}
        disabled={actualizar.isPending}
      >
        <SelectTrigger className="h-7 text-body-sm px-2 w-full max-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_ESTADOS_ETAPA_LEAD.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function makeLeadsColumns(
  selected: Set<string>,
  toggle: (id: string) => void,
  toggleAll: (rows: CrmLeadRow[]) => void,
  allRows: CrmLeadRow[],
  permisos: {
    puedeGestionarLead: (vendedorId: string | null | undefined) => boolean;
    puedeSeleccionar: boolean;
  },
): ColumnDef<CrmLeadRow, unknown>[] {
  const { puedeGestionarLead, puedeSeleccionar } = permisos;
  const allSelected = allRows.length > 0 && allRows.every((r) => selected.has(r.id));
  const columnaSeleccion: ColumnDef<CrmLeadRow, unknown> = {
      id: "sel", header: () => (
        <Checkbox checked={allSelected} onCheckedChange={() => toggleAll(allRows)} aria-label="Seleccionar todos" />
      ),
      meta: { width: COL_W.micro },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(row.original.id)} onCheckedChange={() => toggle(row.original.id)} />
        </div>
      ),
    };
  return defineColumns<CrmLeadRow>([
    ...(puedeSeleccionar ? [columnaSeleccion] : []),
    {
      id: "empresa", header: "Empresa",
      accessorFn: (l) => l.empresa, enableSorting: true,
      sortingFn: sortByString<CrmLeadRow>((l) => l.empresa),
      meta: { width: COL_W.ruta, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => toTitleCase(row.original.empresa),
    },
    { id: "contacto", header: "Contacto", meta: { width: COL_W.nombre, className: "text-body-sm" }, cell: ({ row }) => toTitleCase(row.original.contacto ?? "") },
    { id: "email", header: "Correo", meta: { width: COL_W.texto, className: "text-body-sm truncate hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" }, cell: ({ row }) => row.original.email ?? "" },
    { id: "fuente", header: "Fuente", meta: { width: COL_W.folio, className: "text-body-sm hidden xl:table-cell", headerClassName: "hidden xl:table-cell" }, cell: ({ row }) => row.original.fuente },
    {
      id: "estado", header: "Estado", meta: { width: COL_W.nombre },
      cell: ({ row }) => <EstadoCell lead={row.original} puedeGestionar={puedeGestionarLead(row.original.vendedor_id)} />,
    },
    { id: "score", header: "Score", meta: { width: COL_W.tiny, align: "center", className: "text-center text-body-sm tabular-nums" }, cell: ({ row }) => row.original.score },
  ]);
}
