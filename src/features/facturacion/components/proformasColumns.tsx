/**
 * Definición de columnas JSX del tab de Proformas (Fase 2 — ColumnDef nativo).
 * Se mantiene fuera del hook controller para respetar la separación
 * lógica/presentación: el hook expone datos + handlers, este builder los
 * compone con celdas visuales.
 *
 * Fase 3 (Proforma → Factura): añadida columna de selección (`_select`) que
 * permite escoger varias proformas para fusionarlas en una sola factura.
 */
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatDate, toTitleCase, nombreDesdeEmail } from "@/lib/formatters";
import type { ProformaConFactura } from "@/features/embarques/hooks";
import { sortByString, sortByDate } from "@/components/shared/dataTable/sortingFns";

interface BuildArgs {
  selection?: {
    selectedIds: Set<string>;
    toggle: (id: string) => void;
    isSelectable: (p: ProformaConFactura) => boolean;
  };
}

export function buildProformasColumns({
  selection,
}: BuildArgs): ColumnDef<ProformaConFactura, unknown>[] {
  const cols: ColumnDef<ProformaConFactura, unknown>[] = [];

  if (selection) {
    cols.push({
      id: "_select",
      header: "",
      enableSorting: false,
      meta: { width: "w-[40px]", className: "text-center" },
      cell: ({ row }) => {
        const p = row.original;
        const selectable = selection.isSelectable(p);
        return (
          <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
            <Checkbox
              checked={selection.selectedIds.has(p.id)}
              disabled={!selectable}
              onCheckedChange={() => selection.toggle(p.id)}
              aria-label={`Seleccionar proforma ${p.numero}`}
            />
          </div>
        );
      },
    });
  }

  cols.push(
    {
      id: "numero",
      header: "# Proforma",
      accessorFn: (p) => p.numero,
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.numero),
      meta: { width: "w-[140px]", className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => row.original.numero,
    },
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (p) => p.expediente,
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.expediente),
      meta: { width: "w-[120px]", className: "whitespace-nowrap" },
      cell: ({ row }) => row.original.expediente,
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (p) => p.cliente_nombre,
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.cliente_nombre),
      meta: { width: "min-w-[180px]", className: "max-w-[220px] truncate" },
      cell: ({ row }) => <span title={toTitleCase(row.original.cliente_nombre)}>{toTitleCase(row.original.cliente_nombre)}</span>,
    },
    {
      id: "operador",
      header: "Operador",
      accessorFn: (p) => p.operador ?? "",
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.operador),
      meta: { width: "w-[140px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => row.original.operador ? nombreDesdeEmail(row.original.operador) : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (p) => p.fecha_emision,
      enableSorting: true,
      sortingFn: sortByDate<ProformaConFactura>((p) => p.fecha_emision),
      meta: { width: "w-[100px]", className: "text-xs" },
      cell: ({ row }) => formatDate(row.original.fecha_emision),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (p) => p.estado_proforma ?? "pendiente",
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.estado_proforma ?? "pendiente"),
      meta: { width: "w-[110px]" },
      cell: ({ row }) => {
        const estado = row.original.estado_proforma ?? "pendiente";
        return estado === "facturada"
          ? <Badge variant="success">Facturada</Badge>
          : <Badge variant="warning">Pendiente</Badge>;
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      meta: { width: "w-[200px]" },
      cell: ({ row }) => {
        const p = row.original;
        const facturada = (p.estado_proforma ?? "pendiente") === "facturada";
        const permitirMarcarManual = puedeMarcarManualmente(p.created_at);
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm" disabled={downloadingId === p.id}
              onClick={(e) => { e.stopPropagation(); descargar(p); }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
            {!facturada && permitirMarcarManual && (
              <Button
                variant="default" size="sm"
                onClick={(e) => { e.stopPropagation(); onMarcarFacturada(p); }}
                title="Flujo manual histórico (deprecado para proformas nuevas)"
              >
                <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Facturada
              </Button>
            )}
          </div>
        );
      },
    },
  );

  return defineColumns<ProformaConFactura>(cols);
}
