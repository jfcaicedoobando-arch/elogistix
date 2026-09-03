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

export const baseActividadColumns: ColumnDef<CrmActividadRow, unknown>[] = defineColumns<CrmActividadRow>([
  { id: "tipo", header: "Tipo", meta: { width: COL_W.fecha }, cell: ({ row }) => <Badge variant="outline">{row.original.tipo}</Badge> },
  { id: "asunto", header: "Asunto", meta: { className: "font-medium" }, cell: ({ row }) => row.original.asunto },
  { id: "entidad", header: "Entidad", meta: { className: "text-body-sm" }, cell: ({ row }) => row.original.entidad_tipo },
  { id: "responsable", header: "Responsable", meta: { className: "text-body-sm" }, cell: ({ row }) => row.original.responsable_email || "—" },
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
    id: "fecha_programada", header: "Programada", meta: { className: "text-body-sm" },
    cell: ({ row }) => row.original.fecha_programada ? formatFechaHora(row.original.fecha_programada) : "—",
  },
]);

/**
 * Columna de acciones (completar / posponer / notas). Recibe el predicado de
 * permiso real: espejo de las policies de `crm_actividades` (staff sobre
 * cualquiera, vendedor sólo las propias). Sin permiso la fila no muestra
 * botones que la RLS rechazaría.
 */
export const actividadActionColumn = (
  puedeGestionar: (a: CrmActividadRow) => boolean,
): ColumnDef<CrmActividadRow, unknown> => ({
  id: "acciones", header: "", meta: { width: COL_W.fecha },
  cell: ({ row }) =>
    puedeGestionar(row.original) ? <ActividadRowActions actividad={row.original} /> : null,
});
