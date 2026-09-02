/**
 * Columnas para `CosteoTarifasTable` — extraídas en v13.182.0 (Wave 2 splits).
 */
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByNumber, sortByString, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { TarifaEstadoUnificado } from "../TarifaEstadoUnificado";
import { TarifaRowActions } from "../TarifaRowActions";
import { TarifaQuickApprovalButtons } from "../TarifaQuickApprovalButtons";
import { usd, formatVigencia, vigenciaHint } from "../../routes/CosteoTarifas.helpers";
import type { CosteoTarifaEstado } from "@/features/costeo/types";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

export interface TarifaRow {
  id: string;
  puerto_origen_nombre: string;
  puerto_destino_nombre: string;
  agente_nombre: string;
  naviera_nombre: string;
  tipo_contenedor_nombre: string;
  flete_base: number | string;
  recargos_total: number;
  total_comparable: number;
  vigente_desde: string;
  vigente_hasta: string;
  estado: CosteoTarifaEstado;
  estado_aprobacion?: string;
  motivo_rechazo?: string | null;
}

export interface TarifasColumnsDeps {
  mejorPorGrupo: Map<string, number>;
  aprobarPending: boolean;
  reactivarPending: boolean;
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onEliminar: (id: string) => void;
  onAprobar: (id: string, vigenteHasta: string) => void;
  onRechazar: (id: string) => void;
  onReactivar: (id: string) => void;
}

export function buildTarifasColumns(deps: TarifasColumnsDeps): ColumnDef<TarifaRow, unknown>[] {
  const {
    mejorPorGrupo, aprobarPending, reactivarPending,
    onEditar, onDuplicar, onEliminar, onAprobar, onRechazar, onReactivar,
  } = deps;
  return defineColumns<TarifaRow>([
    {
      id: "ruta",
      header: "Ruta",
      accessorFn: (t) => `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`,
      sortingFn: sortByString((t) => `${t.puerto_origen_nombre} → ${t.puerto_destino_nombre}`),
      enableSorting: true,
      meta: { sticky: true, className: "text-body" },
      cell: ({ row }) => `${row.original.puerto_origen_nombre} → ${row.original.puerto_destino_nombre}`,
    },
    {
      id: "agente",
      header: "Agente / Naviera",
      accessorFn: (t) => t.agente_nombre,
      sortingFn: sortByString((t) => t.agente_nombre),
      enableSorting: true,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.agente_nombre}</div>
          <div className="text-body-sm text-muted-foreground">{row.original.naviera_nombre}</div>
        </div>
      ),
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
      header: "Flete",
      accessorFn: (t) => Number(t.flete_base),
      sortingFn: sortByNumber((t) => Number(t.flete_base)),
      enableSorting: true,
      meta: {
        align: "right",
        className: "tabular-nums hidden lg:table-cell",
        headerClassName: "hidden lg:table-cell",
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
        className: "tabular-nums hidden lg:table-cell",
        headerClassName: "hidden lg:table-cell",
      },
      cell: ({ row }) => usd(row.original.recargos_total),
    },
    {
      id: "total",
      header: "Total USD",
      accessorFn: (t) => t.total_comparable,
      sortingFn: sortByNumber((t) => t.total_comparable),
      enableSorting: true,
      meta: { align: "right", className: "tabular-nums" },
      cell: ({ row }) => {
        const t = row.original;
        const ap = t.estado_aprobacion ?? "vigente";
        const grupoKey = `${t.puerto_origen_nombre}→${t.puerto_destino_nombre}|${t.tipo_contenedor_nombre}`;
        const mejor = mejorPorGrupo.get(grupoKey);
        const esMejor = mejor != null && t.total_comparable === mejor && ap === "vigente";
        const delta = mejor != null && !esMejor && t.total_comparable > mejor ? t.total_comparable - mejor : 0;
        return (
          <div>
            <div className={`font-semibold ${esMejor ? "text-success" : ""}`}>{usd(t.total_comparable)}</div>
            {delta > 0 && (
              <div className="text-label text-muted-foreground">+{usd(delta)} vs mejor</div>
            )}
          </div>
        );
      },
    },
    {
      id: "vigencia",
      header: "Vigencia",
      accessorFn: (t) => t.vigente_hasta,
      sortingFn: sortByDate((t) => t.vigente_hasta),
      enableSorting: true,
      meta: { className: "text-body-sm" },
      cell: ({ row }) => {
        const t = row.original;
        const hint = vigenciaHint(t.vigente_hasta);
        const hintCls =
          hint.tone === "danger" ? "text-destructive"
            : hint.tone === "warn" ? "text-warning"
              : "text-muted-foreground";
        return (
          <div>
            <div className="text-foreground">{formatVigencia(t.vigente_desde, t.vigente_hasta)}</div>
            <div className={hintCls}>{hint.text}</div>
          </div>
        );
      },
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (t) => t.estado_aprobacion ?? "vigente",
      enableSorting: true,
      cell: ({ row }) => {
        const t = row.original;
        return (
          <TarifaEstadoUnificado
            estado={t.estado}
            estadoAprobacion={t.estado_aprobacion ?? "vigente"}
            vigenteHasta={t.vigente_hasta}
            motivo={t.motivo_rechazo}
          />
        );
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      meta: { width: COL_W.nombre, align: "right" },
      cell: ({ row }) => {
        const t = row.original;
        const ap = t.estado_aprobacion ?? "vigente";
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {ap === "borrador" && (
              <TarifaQuickApprovalButtons
                variant="table"
                onAprobar={() => onAprobar(t.id, t.vigente_hasta)}
                onRechazar={() => onRechazar(t.id)}
                disabled={aprobarPending || reactivarPending}
              />
            )}
            <TarifaRowActions
              estadoAprobacion={ap}
              onEditar={() => onEditar(t.id)}
              onDuplicar={() => onDuplicar(t.id)}
              onEliminar={() => onEliminar(t.id)}
              onAprobar={() => onAprobar(t.id, t.vigente_hasta)}
              onRechazar={() => onRechazar(t.id)}
              onReactivar={() => onReactivar(t.id)}
              disabled={aprobarPending || reactivarPending}
            />
          </div>
        );
      },
    },
  ]);
}
