/**
 * Definición de columnas JSX del tab de Proformas (Fase 2 — ColumnDef nativo).
 * Se mantiene fuera del hook controller para respetar la separación
 * lógica/presentación: el hook expone datos + handlers, este builder los
 * compone con celdas visuales.
 *
 * Fase 3 (Proforma → Factura): añadida columna de selección (`_select`) que
 * permite escoger varias proformas para fusionarlas en una sola factura.
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Checkbox } from "@/components/ui/checkbox";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatDate, toTitleCase, nombreDesdeEmail } from "@/lib/formatters";
import type { ProformaConFactura } from "@/features/embarques/hooks";
import { sortByString, sortByDate } from "@/components/shared/dataTable/sortingFns";
import {
  getEstadoUnificado,
  rankEstadoUnificado,
  LABEL_ESTADO_UNIFICADO,
} from "@/lib/domain/estadoUnificado";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { Link } from "react-router-dom";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { Hint } from "@/components/shared/Hint";



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
      meta: { width: COL_W.micro, className: "text-center" },
      cell: ({ row }) => {
        const p = row.original;
        const selectable = selection.isSelectable(p);
        if (!selectable) {
          // Filas no fusionables (facturadas/rechazadas): celda vacía en vez de
          // checkbox deshabilitado, para evitar el cursor `not-allowed` (🚫).
          return <div className="flex justify-center" aria-hidden="true" />;
        }
        return (
          <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
            <Hint label="Seleccionar para fusionar en una factura">
              <Checkbox
                checked={selection.selectedIds.has(p.id)}
                onCheckedChange={() => selection.toggle(p.id)}
                aria-label={`Seleccionar proforma ${p.numero}`}
              />
            </Hint>
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
      meta: { width: COL_W.monto, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => row.original.numero,
    },
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (p) => p.expediente,
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.expediente),
      // Oculto en tableta (<xl) — visible desde el # Proforma sticky y detalle.
      meta: { width: COL_W.folio, className: "whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      // P1 (auditoría v13.823.143 · bug 1): las proformas de embarques sin folio
      // dejaban la celda vacía. Se muestra el fallback canónico y se enlaza al
      // embarque vinculado cuando existe.
      cell: ({ row }) => {
        const p = row.original;
        const label = labelExpediente(p.expediente, p.embarque_id);
        return p.embarque_id ? (
          <Link
            to={`/embarques/${p.embarque_id}`}
            className="underline decoration-dotted hover:text-primary"
            onClick={(e) => e.stopPropagation()}
          >
            {label}
          </Link>
        ) : (
          label
        );
      },
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (p) => p.cliente_nombre,
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.cliente_nombre),
      meta: { width: COL_W.ruta, className: "max-w-[220px] truncate" },
      cell: ({ row }) => <Hint label={toTitleCase(row.original.cliente_nombre)}><span>{toTitleCase(row.original.cliente_nombre)}</span></Hint>,
    },
    {
      id: "operador",
      header: "Operador",
      accessorFn: (p) => p.operador ?? "",
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.operador),
      // Oculto en tableta (<xl) para eliminar scroll horizontal en /proformas.
      meta: { width: COL_W.monto, className: "text-body-sm whitespace-nowrap hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => row.original.operador ? nombreDesdeEmail(row.original.operador) : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (p) => p.fecha_emision,
      enableSorting: true,
      sortingFn: sortByDate<ProformaConFactura>((p) => p.fecha_emision),
      meta: { width: COL_W.fecha, className: "text-body-sm hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
      cell: ({ row }) => formatDate(row.original.fecha_emision),
    },
    {
      id: "estado",
      header: "Estado",
      // Prioridad: rechazada > pendiente > aceptada > facturada (menor rank arriba).
      // Se ordena por un rank numérico para que agrupe por criticidad.
      accessorFn: (p) => rankEstadoUnificado(p),
      enableSorting: true,
      sortingFn: (a, b) => rankEstadoUnificado(a.original) - rankEstadoUnificado(b.original),
      meta: { width: COL_W.monto },
      cell: ({ row }) => {
        const estado = getEstadoUnificado(row.original);
        const label = LABEL_ESTADO_UNIFICADO[estado];
        // v13.681.0 · UI-1: colores desde el statusRegistry (dominio proforma).
        return <StatusBadge domain="proforma" status={estado} label={label} />;
      },
    },

  );

  return defineColumns<ProformaConFactura>(cols);
}
