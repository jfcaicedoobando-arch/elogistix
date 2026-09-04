/**
 * Columnas de la tabla de Prospectos CRM. Extraído de `Prospectos.tsx` para
 * poder compartir la definición con las pruebas de medición sin romper
 * fast-refresh.
 */
import { defineColumns } from "@/components/shared/DataTable";
import { COL_W } from "@/components/shared/dataTable/columnWidths";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { toTitleCase } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";
import type { CrmLeadRow } from "@/features/crm/hooks";

// v13.823.78 — anchos y breakpoints ajustados: en desktop HD (1280x720) la
// tabla desbordaba (~1109px de contenido en ~950px útiles) y "Alta" quedaba
// fuera de vista. Sector y Rutas ahora aparecen desde 2xl; Frecuencia desde xl.
export const prospectosColumns = defineColumns<CrmLeadRow>([
  {
    id: "empresa", header: "Empresa", enableSorting: true,
    accessorFn: (l) => l.empresa,
    meta: { className: "font-medium truncate", sticky: true },
    cell: ({ row }) => toTitleCase(row.original.empresa),
  },
  {
    id: "contacto", header: "Contacto",
    meta: { width: COL_W.nombre, className: "text-body-sm truncate" },
    cell: ({ row }) => toTitleCase(row.original.contacto ?? "") || "—",
  },
  {
    id: "sector", header: "Sector",
    meta: { width: COL_W.nombre, className: "text-body-sm hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
    cell: ({ row }) => row.original.sector ?? "—",
  },
  {
    id: "rutas", header: "Rutas",
    meta: { width: COL_W.texto, className: "text-body-sm truncate hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
    cell: ({ row }) => row.original.rutas ?? "—",
  },
  {
    id: "frecuencia", header: "Frecuencia",
    meta: { width: COL_W.folio, className: "text-body-sm hidden xl:table-cell", headerClassName: "hidden xl:table-cell" },
    cell: ({ row }) => row.original.frecuencia ?? "—",
  },
  {
    id: "estado", header: "Etapa",
    meta: { width: COL_W.estado },
    cell: ({ row }) => <StatusBadge domain="lead" status={row.original.estado} />,
  },
  {
    id: "created_at", header: "Alta", enableSorting: true,
    meta: { width: COL_W.fecha, className: "text-body-sm whitespace-nowrap" },
    cell: ({ row }) => formatFechaEs(row.original.created_at),
  },
]);

