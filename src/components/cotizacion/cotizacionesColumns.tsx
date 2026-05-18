/**
 * Definición de columnas para la tabla de Cotizaciones.
 * Extraído de `pages/cotizaciones/Cotizaciones.tsx` (v8.100.1) para separar
 * lógica de presentación de filas (badges, tonos de vigencia, menú de acciones)
 * del ensamblado de la página.
 *
 * v8.150.0 — `renderEstadoVigencia` y `renderAcciones` movidos a
 * `columnsParts/` para mantener este archivo ≤200 líneas (Power of 10 §20.4).
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DataTableColumn } from "@/components/shared/DataTable";
import { formatDate, formatCurrency, toTitleCase } from "@/lib/formatters";
import type { CotizacionListItem } from "@/hooks/cotizacion";
import { renderEstadoVigencia } from "./columnsParts/estadoVigenciaCell";
import { renderAcciones, type AccionesParams } from "./columnsParts/accionesCell";

interface BuildParams extends AccionesParams {
  canEdit: boolean;
}

/**
 * Construye el array de columnas para `<DataTable>`.
 * Mantener este builder puro: cualquier estado/contexto se inyecta vía `params`.
 */
export function buildCotizacionesColumns(params: BuildParams): DataTableColumn<CotizacionListItem>[] {
  const cols: DataTableColumn<CotizacionListItem>[] = [
    {
      key: "folio",
      header: "Folio",
      width: "w-[120px]",
      className: "font-medium whitespace-nowrap",
      sticky: true,
      sortable: true,
      sortValue: (r) => r.folio,
      render: (r) => r.folio,
    },
    {
      key: "cliente",
      header: "Cliente",
      width: "min-w-[160px]",
      className: "max-w-[180px] truncate",
      sortable: true,
      sortValue: (r) => r.cliente_nombre,
      render: (r) => {
        const nombre = toTitleCase(r.cliente_nombre);
        return <span title={nombre} className="block truncate">{nombre}</span>;
      },
    },
    {
      key: "modo",
      header: "Modo",
      width: "w-[80px]",
      className: "text-xs whitespace-nowrap",
      render: (r) => r.modo,
    },
    {
      key: "ruta",
      header: "Origen → Destino",
      width: "min-w-[160px]",
      className: "text-xs max-w-[200px]",
      render: (r) => {
        const ruta = `${r.origen || "-"} → ${r.destino || "-"}`;
        return (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <span className="block truncate whitespace-nowrap">{ruta}</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[320px] break-words">{ruta}</TooltipContent>
          </Tooltip>
        );
      },
    },
    {
      key: "subtotal",
      header: "Subtotal",
      width: "w-[110px]",
      align: "right",
      className: "text-xs whitespace-nowrap tabular-nums",
      sortable: true,
      sortValue: (r) => r.subtotal,
      render: (r) => formatCurrency(r.subtotal, r.moneda),
    },
    {
      key: "estado_vigencia",
      header: "Estado",
      width: "w-[180px]",
      sortable: true,
      sortValue: (r) => r.estado,
      render: renderEstadoVigencia,
    },
    {
      key: "fecha",
      header: "Fecha",
      width: "w-[130px]",
      className: "text-xs whitespace-nowrap",
      sortable: true,
      sortValue: (r) => r.created_at,
      render: (r) => formatDate(r.created_at, "dd/MM/yyyy HH:mm"),
    },
  ];

  if (params.canEdit) {
    cols.push({
      key: "acciones",
      header: "",
      headerClassName: "w-[60px]",
      render: (r) =>
        renderAcciones(r, {
          onEditar: params.onEditar,
          onDuplicar: params.onDuplicar,
          onEliminar: params.onEliminar,
        }),
    });
  }

  return cols;
}
