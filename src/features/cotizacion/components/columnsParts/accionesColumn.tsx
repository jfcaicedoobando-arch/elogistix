/**
 * Columna de acciones de Cotizaciones — extraída de cotizacionesColumns.tsx
 * (Power of 10: el archivo superaba 200 líneas).
 */
import { Trash2, Copy } from "lucide-react";
import { actionsColumn } from "@/components/shared/dataTable/columnBuilders";
import { type ColumnDef } from "@/components/shared/DataTable";
import type { CotizacionListItem } from "@/features/cotizacion/hooks";
import type { BuildParams } from "../cotizacionesColumns";

export function buildAccionesColumn(
  params: BuildParams,
): ColumnDef<CotizacionListItem, unknown> | null {
  if (!params.canDuplicar && !params.canEliminar) return null;
  return actionsColumn<CotizacionListItem>({
    items: () => [
      ...(params.canDuplicar && params.onDuplicar
        ? [
            {
              label: "Duplicar",
              icon: <Copy className="h-4 w-4" />,
              onSelect: (row: CotizacionListItem) => params.onDuplicar?.(row.id),
            },
          ]
        : []),
      ...(params.canEliminar
        ? [
            {
              label: "Eliminar",
              icon: <Trash2 className="h-4 w-4" />,
              variant: "destructive" as const,
              onSelect: (row: CotizacionListItem) => params.onEliminar(row.id),
            },
          ]
        : []),
    ],
  });
}
