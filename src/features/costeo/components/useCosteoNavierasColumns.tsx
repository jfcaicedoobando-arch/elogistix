/**
 * Definición de columnas de la tabla de `CosteoNavieras`.
 */
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { CartaGarantiaBadge } from "@/components/shared/CartaGarantiaBadge";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { Settings2 } from "lucide-react";
import type { FilaNaviera } from "@/features/costeo/types/filaNaviera";

export function useCosteoNavierasColumns(
  onConfigurar: (fila: FilaNaviera) => void,
): ColumnDef<FilaNaviera, unknown>[] {
  return useMemo(
    () =>
      defineColumns<FilaNaviera>([
        {
          id: "naviera",
          header: "Naviera",
          accessorFn: (f) => f.naviera_nombre,
          enableSorting: true,
          meta: { width: COL_W.ruta, className: "font-medium whitespace-nowrap", sticky: true },
          cell: ({ row }) => row.original.naviera_nombre,
        },
        {
          id: "scac",
          header: "SCAC",
          meta: { width: COL_W.fecha, className: "font-mono text-body-sm" },
          cell: ({ row }) => row.original.naviera_code,
        },
        {
          id: "carta",
          header: "Carta garantía",
          meta: { width: COL_W.nombre },
          cell: ({ row }) => (
            <CartaGarantiaBadge
              tieneCarta={row.original.condicion?.tiene_carta_garantia ?? false}
              vigenteHasta={row.original.condicion?.carta_garantia_vigente_hasta ?? null}
            />
          ),
        },
        {
          id: "diaslibres",
          header: "Días libres",
          meta: { width: COL_W.fecha, align: "right", className: "tabular-nums" },
          cell: ({ row }) => row.original.condicion?.dias_libres_demoras_default ?? "—",
        },
        {
          id: "vinculo",
          header: "Proveedor vinculado",
          meta: {
            width: COL_W.nombre,
            className: "text-muted-foreground hidden xl:table-cell",
            headerClassName: "hidden xl:table-cell",
          },
          cell: ({ row }) => (row.original.condicion ? "Vinculado" : "Sin configurar"),
        },
        {
          id: "acciones",
          header: "Acciones",
          meta: { width: COL_W.monto, align: "right" },
          cell: ({ row }) => (
            <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
              <Button size="sm" variant="outline" onClick={() => onConfigurar(row.original)}>
                <Settings2 className="size-4 mr-1" /> Configurar
              </Button>
            </div>
          ),
        },
      ]),
    [onConfigurar],
  );
}
