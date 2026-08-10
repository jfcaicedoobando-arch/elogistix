/**
 * Columnas de selección y folio de la tabla Cartera.
 * Extraídas de `carteraColumns.tsx` (Power of 10: archivos ≤ 200 líneas).
 * v13.490.0 — el área completa de la celda selecciona; el folio es el único
 * drilldown explícito y abre en pestaña nueva mientras haya selección.
 */
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { defineColumns } from "@/components/shared/DataTable";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import type { CarteraRow } from "./carteraColumns.types";

/** Evita el doble toggle cuando el clic ya cayó sobre el propio checkbox. */
function esClickEnCheckbox(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[role="checkbox"]');
}

export function buildCarteraSelectionColumns() {
  return defineColumns<CarteraRow>([
    {
      id: "selection",
      header: ({ table }) => (
        <div
          className="flex h-9 w-full cursor-pointer items-center justify-center"
          data-no-row-nav
          onClick={(e) => {
            e.stopPropagation();
            if (esClickEnCheckbox(e.target)) return;
            table.toggleAllPageRowsSelected(!table.getIsAllPageRowsSelected());
          }}
          role="presentation"
        >
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected()
                ? true
                : table.getIsSomePageRowsSelected()
                  ? "indeterminate"
                  : false
            }
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Seleccionar todas"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div
          className="flex h-9 w-full cursor-pointer items-center justify-center"
          data-no-row-nav
          onClick={(e) => {
            e.stopPropagation();
            if (esClickEnCheckbox(e.target)) return;
            row.toggleSelected(!row.getIsSelected());
          }}
          role="presentation"
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Seleccionar factura ${row.original.numero ?? ""}`}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { width: COL_W.micro, className: "p-0" },
    },
    {
      id: "numero",
      header: "Folio",
      accessorFn: (r) => r.numero ?? "",
      enableSorting: true,
      meta: { width: COL_W.monto, className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row, table }) => {
        const haySeleccion = table.getSelectedRowModel().rows.length > 0;
        return (
          <Link
            to={`/facturacion/${row.original.factura_id}`}
            data-no-row-nav
            target={haySeleccion ? "_blank" : undefined}
            rel={haySeleccion ? "noopener noreferrer" : undefined}
            title={haySeleccion ? "Se abre en pestaña nueva para no perder tu selección" : undefined}
            className="underline-offset-2 hover:underline focus-visible:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {row.original.numero ?? "—"}
          </Link>
        );
      },
    },
  ]);
}
