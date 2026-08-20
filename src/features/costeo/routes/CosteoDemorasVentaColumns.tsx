/**
 * Definición de columnas de la tabla de tarifas de demoras (venta).
 * Extraído de CosteoDemorasVenta.tsx para respetar el límite de líneas.
 */
import { Button } from "@/components/ui/button";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { moneyColumn, dateColumn } from "@/components/shared/dataTable/columnBuilders";
import { Trash2 } from "lucide-react";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import type { DemoraVentaTarifaInput } from "@/features/costeo/services/demorasVenta";

type Tarifa = DemoraVentaTarifaInput & { id: string };

export function crearColumnasDemorasVenta(
  tipoMap: Map<string, string>,
  onEliminar: (id: string) => void,
): ColumnDef<Tarifa, unknown>[] {
  return defineColumns<Tarifa>([
    {
      id: "tipo",
      header: "Tipo contenedor",
      meta: { width: COL_W.nombre, className: "font-medium", sticky: true },
      cell: ({ row }) => tipoMap.get(row.original.tipo_contenedor_id) ?? "—",
    },
    {
      id: "desde",
      header: "Desde día",
      meta: { width: COL_W.fecha, align: "right", className: "tabular-nums" },
      cell: ({ row }) => row.original.desde_dia,
    },
    {
      id: "hasta",
      header: "Hasta día",
      meta: { width: COL_W.fecha, align: "right", className: "tabular-nums" },
      cell: ({ row }) =>
        row.original.hasta_dia ?? <span aria-label="sin límite">∞</span>,
    },
    {
      ...moneyColumn<Tarifa>({
        id: "monto",
        header: "Monto/día USD",
        accessor: (t) => Number(t.monto_por_dia_usd),
        defaultCurrency: "USD",
      }),
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums whitespace-nowrap font-medium" },
    },
    {
      ...dateColumn<Tarifa>({
        id: "desde_vig",
        header: rangoLabel("Vigencia", "desde"),
        accessor: (t) => t.vigente_desde,
      }),
      meta: { width: COL_W.monto, className: "text-body-sm whitespace-nowrap hidden md:table-cell", headerClassName: "hidden md:table-cell" },
    },
    {
      ...dateColumn<Tarifa>({
        id: "hasta_vig",
        header: rangoLabel("Vigencia", "hasta"),
        accessor: (t) => t.vigente_hasta,
      }),
      meta: { width: COL_W.monto, className: "text-body-sm whitespace-nowrap hidden md:table-cell", headerClassName: "hidden md:table-cell" },
    },
    {
      id: "acciones",
      header: "",
      meta: { width: COL_W.micro, align: "right" },
      cell: ({ row }) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onEliminar(row.original.id)}
            aria-label="Eliminar tarifa de demoras"
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]);
}
