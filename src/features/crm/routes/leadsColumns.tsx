import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString } from "@/components/shared/dataTable/sortingFns";
import { toTitleCase } from "@/lib/formatters";
import { notifyError } from "@/lib/ui/appFeedback";
import { LEAD_ESTADOS, useActualizarLead, type CrmLeadEstado, type CrmLeadRow } from "@/features/crm/hooks";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

const ESTADO_VARIANT: Record<CrmLeadEstado, "default" | "secondary" | "outline" | "destructive"> = {
  Nuevo: "default",
  Contactado: "secondary",
  Calificado: "default",
  Descalificado: "destructive",
  Convertido: "outline",
};

function EstadoCell({ lead }: { lead: CrmLeadRow }) {
  const actualizar = useActualizarLead();
  if (lead.estado === "Convertido") {
    return <Badge variant={ESTADO_VARIANT[lead.estado]}>{lead.estado}</Badge>;
  }
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={lead.estado}
        onValueChange={async (v) => {
          if (v === lead.estado) return;
          try {
            await actualizar.mutateAsync({ id: lead.id, patch: { estado: v as CrmLeadEstado } });
          } catch (err) {
            notifyError(undefined, { title: "No se pudo actualizar", description: err instanceof Error ? err.message : undefined, error: err, method: "ESTADO_CELL" });
          }
        }}
        disabled={actualizar.isPending}
      >
        <SelectTrigger className="h-7 text-xs px-2 w-full max-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {LEAD_ESTADOS.filter((s) => s !== "Convertido").map((s) => (
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
): ColumnDef<CrmLeadRow, unknown>[] {
  const allSelected = allRows.length > 0 && allRows.every((r) => selected.has(r.id));
  return defineColumns<CrmLeadRow>([
    {
      id: "sel", header: () => (
        <Checkbox checked={allSelected} onCheckedChange={() => toggleAll(allRows)} aria-label="Seleccionar todos" />
      ),
      meta: { width: COL_W.micro },
      cell: ({ row }) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={selected.has(row.original.id)} onCheckedChange={() => toggle(row.original.id)} />
        </div>
      ),
    },
    {
      id: "empresa", header: "Empresa",
      accessorFn: (l) => l.empresa, enableSorting: true,
      sortingFn: sortByString<CrmLeadRow>((l) => l.empresa),
      meta: { width: COL_W.ruta, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => toTitleCase(row.original.empresa),
    },
    { id: "contacto", header: "Contacto", meta: { width: COL_W.nombre, className: "text-xs" }, cell: ({ row }) => toTitleCase(row.original.contacto ?? "") },
    { id: "email", header: "Email", meta: { width: COL_W.texto, className: "text-xs truncate hidden xl:table-cell", headerClassName: "hidden xl:table-cell" }, cell: ({ row }) => row.original.email ?? "" },
    { id: "fuente", header: "Fuente", meta: { width: COL_W.folio, className: "text-xs hidden xl:table-cell", headerClassName: "hidden xl:table-cell" }, cell: ({ row }) => row.original.fuente },
    {
      id: "estado", header: "Estado", meta: { width: COL_W.nombre },
      cell: ({ row }) => <EstadoCell lead={row.original} />,
    },
    { id: "score", header: "Score", meta: { width: COL_W.tiny, align: "center", className: "text-center text-xs tabular-nums" }, cell: ({ row }) => row.original.score },
  ]);
}
