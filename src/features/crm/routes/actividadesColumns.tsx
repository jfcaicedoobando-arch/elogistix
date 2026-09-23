/**
 * Columnas de la tabla de Actividades CRM. Extraído de `Actividades.tsx`
 * para mantener la ruta bajo el límite de 200 líneas (Power of 10).
 */
import { Badge } from "@/components/ui/badge";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { statusColumn } from "@/components/shared/dataTable/columnBuilders";
import ActividadRowActions from "@/features/crm/components/ActividadRowActions";
import type { CrmActividadRow } from "@/features/crm/hooks";
import { formatFechaHora } from "@/lib/formatters/dates";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { Hint } from "@/components/shared/Hint";
import {
  ACTIVIDAD_ENTIDAD_LABEL,
  ACTIVIDAD_TIPO_LABEL,
  actividadTipoVariant,
} from "@/features/crm/domain/actividadLabels";

export const baseActividadColumns: ColumnDef<CrmActividadRow, unknown>[] = defineColumns<CrmActividadRow>([
  // v13.823.78 — anchos compactados para que la tabla quepa en 1280x720 sin
  // scroll horizontal (antes ~996px de contenido en ~950px de ancho útil).
  {
    id: "tipo", header: "Tipo", meta: { width: COL_W.short },
    cell: ({ row }) => <Badge variant={actividadTipoVariant(row.original.tipo)}>{ACTIVIDAD_TIPO_LABEL[row.original.tipo]}</Badge>,
  },
  {
    id: "asunto", header: "Asunto", meta: { className: "max-w-52 font-medium" },
    cell: ({ row }) => <Hint label={row.original.asunto}><span className="block truncate">{row.original.asunto}</span></Hint>,
  },
  {
    id: "entidad", header: "Entidad", meta: { width: COL_W.short, className: "text-body-sm" },
    cell: ({ row }) => <Badge variant="neutral">{ACTIVIDAD_ENTIDAD_LABEL[row.original.entidad_tipo]}</Badge>,
  },
  {
    id: "responsable", header: "Responsable",
    meta: { width: COL_W.nombre, className: "hidden text-body-sm truncate 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
    cell: ({ row }) => row.original.responsable_email || "—",
  },
  {
    ...statusColumn<CrmActividadRow>({
      domain: "actividad_crm",
      // B-055 (v13.320.40): distinguir "Vencida" cuando la actividad no completada
      // ya pasó su fecha programada. Antes todo lo no completado era "Pendiente".
      accessor: (a) => {
        if (a.fecha_completada) return "Completada";
        if (a.fecha_programada && new Date(a.fecha_programada).getTime() < Date.now()) return "Vencida";
        return "Pendiente";
      },
    }),
    meta: { width: COL_W.fecha },
  },
  {
    id: "fecha_programada", header: "Programada", meta: { width: COL_W.estado, className: "text-body-sm" },
    cell: ({ row }) => row.original.fecha_programada ? formatFechaHora(row.original.fecha_programada) : "—",
  },
]);

/**
 * Columna de acciones (completar / posponer / notas). Recibe el predicado de
 * permiso real: espejo de las policies de `crm_actividades` (staff sobre
 * cualquiera, vendedor sólo las propias). Sin permiso la fila no muestra
 * botones que la RLS rechazaría.
 *
 * `stickyRight`: si por resoluciones angostas la tabla llega a desplazarse,
 * las acciones permanecen visibles sin ocultar datos.
 */
export const actividadActionColumn = (
  puedeGestionar: (a: CrmActividadRow) => boolean,
): ColumnDef<CrmActividadRow, unknown> => ({
  id: "acciones", header: "", meta: { width: COL_W.acciones, stickyRight: true, align: "right" },
  cell: ({ row }) =>
    puedeGestionar(row.original) ? <ActividadRowActions actividad={row.original} /> : null,
});

