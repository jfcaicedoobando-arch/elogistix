/**
 * Columnas de la tabla Cotizaciones — Oleada 1 migration.
 * Usa `columnBuilders` compartidos para cliente, subtotal, fecha y acciones.
 * La celda `estado_vigencia` mantiene lógica compuesta (vigencia + badges extra).
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { type ColumnDef } from "@/components/shared/DataTable";
import type { CotizacionListItem } from "@/features/cotizacion/hooks";
import { renderEstadoVigencia } from "./columnsParts/estadoVigenciaCell";
import { formatFechaHora } from "@/lib/formatters";
import { actionsColumn } from "@/components/shared/dataTable/columnBuilders";
import { Hint } from "@/components/shared/Hint";
import { Trash2, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { normalizarSubtotalesMxn } from "@/features/cotizacion/domain/subtotalesPorMoneda";
import { SubtotalCotizacionCell } from "./columnsParts/subtotalCell";
import { subtotalesDeFila } from "./columnsParts/subtotalesDeFila";
import { COL_W } from "@/components/shared/dataTable/columnWidths";

/** Folio con los datos secundarios (Tipo, Modo, Ruta, Fecha) a la mano. */
function FolioCotizacionCell({ cotizacion }: { cotizacion: CotizacionListItem }) {
  const esInfo = cotizacion.tipo_documento === "informativa";
  const detalle = [
    `Tipo: ${esInfo ? "Tarifario" : "Transaccional"}`,
    `Modo: ${cotizacion.modo || "—"}`,
    `Ruta: ${cotizacion.origen || "-"} → ${cotizacion.destino || "-"}`,
    `Fecha: ${cotizacion.created_at ? formatFechaHora(cotizacion.created_at) : "—"}`,
  ].join(" · ");
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <span className="block truncate">{cotizacion.folio}</span>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-body-sm max-w-[320px] break-words">{detalle}</TooltipContent>
    </Tooltip>
  );
}

export interface BuildParams {
  canEdit: boolean;
  onEliminar: (id: string) => void;
  onDuplicar?: (id: string) => void;
  /** TC USD→MXN vigente, usado sólo para ordenar el subtotal multimoneda. */
  usdMxn?: number | null;
  /** TC EUR→MXN vigente; si falta, filas con EUR quedan al final del orden (no se comparan nominalmente). */
  eurMxn?: number | null;
}

export function buildCotizacionesColumns(params: BuildParams): ColumnDef<CotizacionListItem, unknown>[] {
  const cols: ColumnDef<CotizacionListItem, unknown>[] = [
    {
      id: "folio",
      header: "Folio",
      accessorFn: (r) => r.folio,
      enableSorting: true,
      // Con la tabla ajustada al ancho disponible (`table-fixed`), el peldaño de
      // folio (112px) truncaba "COT-2026-0239"; se usa el peldaño de nombre.
      meta: { width: COL_W.nombre, className: "font-medium whitespace-nowrap", sticky: true },
      // MEJ-20260908-01: en 1280x720 Tipo/Modo/Ruta/Fecha quedan fuera de la
      // tabla (se muestran desde 2xl). El folio conserva el acceso a esos datos
      // en un tooltip, sin agregar un selector de columnas.
      cell: ({ row }) => <FolioCotizacionCell cotizacion={row.original} />,
    },
    {
      id: "cliente",
      header: "Cliente",
      // Las cotizaciones de prospecto muestran la empresa capturada (sin alta
      // en el catálogo de clientes) y un badge para no mezclar embudos.
      accessorFn: (r) => (r.es_prospecto ? r.prospecto_empresa : r.cliente_nombre) ?? "",
      enableSorting: true,
      cell: ({ row }) => {
        const r = row.original;
        const nombre = r.es_prospecto
          ? (r.prospecto_empresa || r.cliente_nombre)
          : r.cliente_nombre;
        return (
          <span className="flex items-center gap-2 min-w-0">
            {/* MEJ-20260908-01: el nombre puede truncarse al ajustar la tabla al
                ancho disponible; el tooltip conserva el texto completo. */}
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <span className="truncate">{nombre}</span>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-body-sm max-w-[320px] break-words">{nombre || "—"}</TooltipContent>
            </Tooltip>
            {r.es_prospecto === true && (
              <Badge variant="info" size="sm" className="shrink-0">Prospecto</Badge>
            )}
          </span>
        );
      },
    },
    {
      id: "tipo_doc",
      header: "Tipo",
      // Oculto en tableta (<xl) — información secundaria (Tarifario vs Transaccional).
      meta: { width: COL_W.fecha, className: "text-body-sm hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
      cell: ({ row }) => {
        const esInfo = row.original.tipo_documento === "informativa";
        return (
          <Badge variant={esInfo ? "info" : "neutral"} size="sm">
            {esInfo ? "Tarifario" : "Transaccional"}
          </Badge>
        );
      },
    },
    {
      id: "modo",
      header: "Modo",
      // Oculto en tableta (<xl).
      meta: { width: COL_W.short, className: "text-body-sm whitespace-nowrap hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
      cell: ({ row }) => row.original.modo,
    },
    {
      id: "ruta",
      header: "Origen → Destino",
      // Oculto en tableta (<xl) — la ruta se ve en el detalle.
      // VF-15: el tope de 200px truncaba "Shanghái → Manzanillo" habiendo
      // ancho disponible; se amplía al peldaño canónico de ruta.
      meta: { width: COL_W.ruta, className: "text-body-sm max-w-[320px] hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
      cell: ({ row }) => {
        const r = row.original;
        const ruta = `${r.origen || "-"} → ${r.destino || "-"}`;
        return (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <span className="block truncate whitespace-nowrap">{ruta}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-body-sm max-w-[320px] break-words">{ruta}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      id: "subtotal",
      header: () => (
        <Hint label="Cotizaciones mixtas muestran un renglón por moneda. Ordenado por equivalente en MXN">
          <span>Subtotal</span>
        </Hint>
      ),
      accessorFn: (r) => r.subtotal ?? 0,
      enableSorting: true,
      cell: ({ row }) => <SubtotalCotizacionCell cotizacion={row.original} />,
      // FIX 10: ordenar por equivalente en MXN evita mezclar montos nominales
      // de MXN y USD; sin TC confiable el valor queda al final.
      sortingFn: (a, b) => {
        const va = normalizarSubtotalesMxn(subtotalesDeFila(a.original), params.usdMxn, params.eurMxn);
        const vb = normalizarSubtotalesMxn(subtotalesDeFila(b.original), params.usdMxn, params.eurMxn);
        const fa = va == null || !Number.isFinite(va) ? Number.POSITIVE_INFINITY : va;
        const fb = vb == null || !Number.isFinite(vb) ? Number.POSITIVE_INFINITY : vb;
        return fa - fb;
      },
    },

    {
      id: "estado_vigencia",
      header: "Estado",
      accessorFn: (r) => r.estado,
      enableSorting: true,
      meta: { width: COL_W.estado },
      // renderEstadoVigencia usa StatusBadge internamente (Oleada 1 migrado)
      cell: ({ row }) => renderEstadoVigencia(row.original),
    },
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (r) => r.created_at ?? "",
      enableSorting: true,
      // VF-04: `formatDate` (date-fns) usa la TZ del navegador/servidor y el
      // listado mostraba la hora del servidor. Se formatea con el formatter
      // canónico TZ_MX, igual que "Mi día" de CRM.
      cell: ({ row }) => (
        <span className="tabular-nums whitespace-nowrap">
          {row.original.created_at ? formatFechaHora(row.original.created_at) : "—"}
        </span>
      ),
      // Fecha oculta en tableta (<xl).
      meta: { width: COL_W.monto, className: "hidden 2xl:table-cell", headerClassName: "hidden 2xl:table-cell" },
    },
  ];

  if (params.canEdit) {
    cols.push(
      actionsColumn<CotizacionListItem>({
        items: () => [
          ...(params.onDuplicar
            ? [
                {
                  label: "Duplicar",
                  icon: <Copy className="h-4 w-4" />,
                  onSelect: (row: CotizacionListItem) => params.onDuplicar?.(row.id),
                },
              ]
            : []),
          {
            label: "Eliminar",
            icon: <Trash2 className="h-4 w-4" />,
            variant: "destructive" as const,
            onSelect: (row: CotizacionListItem) => params.onEliminar(row.id),
          },
        ],
      }),
    );
  }


  return cols;
}
