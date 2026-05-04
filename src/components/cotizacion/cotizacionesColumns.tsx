/**
 * Definición de columnas para la tabla de Cotizaciones.
 * Extraído de `pages/cotizaciones/Cotizaciones.tsx` (v8.100.1) para separar
 * lógica de presentación de filas (badges, tonos de vigencia, menú de acciones)
 * del ensamblado de la página.
 */
import type { ReactNode } from "react";
import { MoreHorizontal, Pencil, Copy, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DataTableColumn } from "@/components/shared/DataTable";
import { formatDate, formatCurrency, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import type { CotizacionListItem } from "@/hooks/cotizacion/useCotizacionesPageController";

/**
 * Render de la celda combinada Estado + Vigencia.
 * - Estado siempre como badge primario.
 * - Vigencia como línea secundaria con tono según urgencia (solo cuando estado="Enviada").
 */
function renderEstadoVigencia(r: CotizacionListItem): ReactNode {
  const estado = r.estado || "—";
  let vigenciaNode: ReactNode = null;

  if (r.fecha_vigencia) {
    const fechaStr = formatDate(r.fecha_vigencia);
    const esEnviada = (r.estado || "").toLowerCase() === "enviada";

    if (!esEnviada) {
      vigenciaNode = <span className="text-muted-foreground">Vence {fechaStr}</span>;
    } else {
      const fecha = new Date(r.fecha_vigencia);
      const hoy = new Date();
      const diffDias = Math.ceil((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDias < 0) {
        vigenciaNode = <span className="text-destructive font-medium">Vencida · {fechaStr}</span>;
      } else if (diffDias <= 3) {
        vigenciaNode = (
          <span className="text-warning font-medium">
            {diffDias === 0 ? "Vence hoy" : `Vence en ${diffDias}d`} · {fechaStr}
          </span>
        );
      } else {
        vigenciaNode = <span className="text-muted-foreground">Vence {fechaStr}</span>;
      }
    }
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <Badge
        variant="secondary"
        className={`w-fit text-xs whitespace-nowrap ${getEstadoColor(estado)}`}
      >
        {estado}
      </Badge>
      {vigenciaNode && <span className="text-[10px] whitespace-nowrap">{vigenciaNode}</span>}
    </div>
  );
}

interface AccionesParams {
  onEditar: (id: string) => void;
  onDuplicar: (id: string) => void;
  onEliminar: (id: string) => void;
}

function renderAcciones(r: CotizacionListItem, params: AccionesParams) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Acciones de la cotización"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); params.onEditar(r.id); }}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); params.onDuplicar(r.id); }}>
          <Copy className="mr-2 h-4 w-4" /> Duplicar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={(e) => { e.stopPropagation(); params.onEliminar(r.id); }}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
