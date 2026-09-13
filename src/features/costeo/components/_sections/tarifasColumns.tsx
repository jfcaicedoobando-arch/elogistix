/**
 * Columnas para `CosteoTarifasTable` — extraídas en v13.182.0 (Wave 2 splits).
 */
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByNumber, sortByString, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { usd, formatVigencia } from "../../routes/CosteoTarifas.helpers";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import {
  AccionesTarifaCell,
  EstadoTarifaCell,
  TotalTarifaCell,
  VigenciaTarifaCell,
} from "./tarifasColumns.cells";

export type { TarifaRow, TarifasColumnsDeps } from "./tarifasColumns.types";
import type { TarifaRow, TarifasColumnsDeps } from "./tarifasColumns.types";

export function buildTarifasColumns(deps: TarifasColumnsDeps): ColumnDef<TarifaRow, unknown>[] {
  const { mejorPorGrupo } = deps;
  return defineColumns<TarifaRow>([
    {
      id: "ruta",
      header: "Ruta",
      accessorFn: (t) => `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`,
      sortingFn: sortByString((t) => `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`),
      enableSorting: true,
      meta: { sticky: true, width: COL_W.ruta, className: "text-body" },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">{row.original.puerto_origen_nombre} → {row.original.puerto_destino_nombre}</div>
          {/* MR-UI-02: bajo 2xl (1280×720) Contenedor y Vigencia viven aquí
              para que la tabla no requiera scroll horizontal. */}
          <div className="text-label text-muted-foreground 2xl:hidden">
            {row.original.tipo_contenedor_nombre}
            {" · "}
            {formatVigencia(row.original.vigente_desde, row.original.vigente_hasta)}
          </div>
        </div>
      ),
    },
    {
      id: "agente",
      header: "Agente / Naviera",
      accessorFn: (t) => t.agente_nombre,
      sortingFn: sortByString((t) => t.agente_nombre),
      enableSorting: true,
      meta: { width: COL_W.texto },
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="font-medium">{row.original.agente_nombre}</div>
          <div className="truncate text-body-sm text-muted-foreground">{row.original.naviera_nombre}</div>
        </div>
      ),
    },
    {
      id: "contenedor",
      header: "Contenedor",
      accessorFn: (t) => t.tipo_contenedor_nombre,
      enableSorting: true,
      meta: {
        className: "hidden 2xl:table-cell",
        headerClassName: "hidden 2xl:table-cell",
      },
      cell: ({ row }) => row.original.tipo_contenedor_nombre,
    },
    {
      id: "flete",
      header: "Flete",
      accessorFn: (t) => Number(t.flete_base),
      sortingFn: sortByNumber((t) => Number(t.flete_base)),
      enableSorting: true,
      // MR-UI-02: Flete y Recargos se ocultan bajo 2xl (<1536 px) para que
      // Ruta, Estado y Acciones quepan en 1280×720; el desglose sigue
      // disponible en pantallas amplias y el Total ya incluye ambos montos.
      meta: {
        align: "right",
        className: "tabular-nums hidden 2xl:table-cell",
        headerClassName: "hidden 2xl:table-cell",
      },
      cell: ({ row }) => usd(Number(row.original.flete_base)),
    },
    {
      id: "recargos",
      header: "Recargos",
      accessorFn: (t) => t.recargos_total,
      sortingFn: sortByNumber((t) => t.recargos_total),
      enableSorting: true,
      meta: {
        align: "right",
        className: "tabular-nums hidden 2xl:table-cell",
        headerClassName: "hidden 2xl:table-cell",
      },
      cell: ({ row }) => usd(row.original.recargos_total),
    },
    {
      id: "total",
      header: "Total USD",
      accessorFn: (t) => t.total_comparable,
      sortingFn: sortByNumber((t) => t.total_comparable),
      enableSorting: true,
      meta: { width: COL_W.monto, align: "right", className: "tabular-nums" },
      cell: ({ row }) => <TotalTarifaCell t={row.original} mejorPorGrupo={mejorPorGrupo} />,
    },
    {
      id: "vigencia",
      header: "Vigencia",
      accessorFn: (t) => t.vigente_hasta,
      sortingFn: sortByDate((t) => t.vigente_hasta),
      enableSorting: true,
      // MR-UI-02: se muestra desde 2xl; en pantallas menores el resumen de
      // vigencia aparece bajo la Ruta.
      meta: {
        width: COL_W.ruta,
        className: "text-body-sm hidden 2xl:table-cell",
        headerClassName: "hidden 2xl:table-cell",
      },
      cell: ({ row }) => <VigenciaTarifaCell t={row.original} />,
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (t) => t.estado_aprobacion ?? "vigente",
      enableSorting: true,
      // MR-UI-02: Estado permanece en el flujo horizontal. Sólo Acciones se
      // fija para evitar que esta celda cubra Contenedor, Total o Vigencia.
      meta: { width: COL_W.estado },
      cell: ({ row }) => <EstadoTarifaCell t={row.original} />,
    },
    {
      id: "acciones",
      header: "Acciones",
      // MR-UI-02: sólo Acciones permanece fija y conserva Aprobar/Rechazar
      // visibles y enfocables mientras el resto de columnas se desplaza.
      meta: { width: COL_W.estado, align: "right", stickyRight: true },
      cell: ({ row }) => <AccionesTarifaCell t={row.original} deps={deps} />,
    },
  ]);
}
