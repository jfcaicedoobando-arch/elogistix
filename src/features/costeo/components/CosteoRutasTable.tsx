/**
 * Tabla de rutas marítimas (cuerpo de CosteoRutas).
 * v13.172.17: migrado a `DataTable` (Fase 4 homologación); preserva
 * onRowClick para navegar a `/costeo/tarifas` y estado derivado con `computeRutaEstado`.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, ExternalLink, Trash2 } from "lucide-react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { statusColumn } from "@/components/shared/dataTable/columnBuilders";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import {
  computeRutaEstado, diasParaExpirar, DIAS_POR_VENCER, type RutaEstadoMeta,
} from "@/features/costeo/utils/rutaEstado";

const TONE_VARIANT: Record<RutaEstadoMeta["tone"], "default" | "destructive" | "secondary" | "outline"> = {
  success: "default",
  warning: "outline",
  destructive: "destructive",
  muted: "secondary",
};

function formatFecha(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" });
}

interface RutaRow {
  id: string;
  puerto_origen_nombre?: string | null;
  puerto_destino_nombre?: string | null;
  tarifas_vigentes_count?: number | null;
  proveedores_count?: number | null;
  proxima_expiracion?: string | null;
  ultima_actualizacion_tarifa?: string | null;
}

interface FilaRuta {
  ruta: RutaRow;
  meta: RutaEstadoMeta;
}

interface Props {
  rutasOrdenadas: FilaRuta[];
  isLoading: boolean;
  totalRutas: number;
  onEliminar: (id: string) => void;
}

export function CosteoRutasTable({ rutasOrdenadas, isLoading, totalRutas, onEliminar }: Props) {
  const navigate = useNavigate();

  const columns = useMemo<ColumnDef<FilaRuta, unknown>[]>(
    () => defineColumns<FilaRuta>([
      {
        id: "origen",
        header: "Origen (CN)",
        accessorFn: (f) => f.ruta.puerto_origen_nombre ?? "",
        sortingFn: sortByString((f) => f.ruta.puerto_origen_nombre),
        enableSorting: true,
        meta: { sticky: true, className: "font-medium" },
        cell: ({ row }) => row.original.ruta.puerto_origen_nombre ?? "—",
      },
      {
        id: "destino",
        header: "Destino (MX)",
        accessorFn: (f) => f.ruta.puerto_destino_nombre ?? "",
        sortingFn: sortByString((f) => f.ruta.puerto_destino_nombre),
        enableSorting: true,
        cell: ({ row }) => row.original.ruta.puerto_destino_nombre ?? "—",
      },
      {
        id: "tarifas",
        header: "Tarifas vigentes",
        accessorFn: (f) => f.ruta.tarifas_vigentes_count ?? 0,
        sortingFn: sortByNumber((f) => f.ruta.tarifas_vigentes_count ?? 0),
        enableSorting: true,
        meta: { align: "center" },
        cell: ({ row }) => {
          const count = row.original.ruta.tarifas_vigentes_count ?? 0;
          if (count === 0) return <Badge variant="destructive">Sin tarifa</Badge>;
          return <Badge variant={count >= 3 ? "default" : "outline"}>{count}</Badge>;
        },
      },
      {
        id: "proveedores",
        header: "Proveedores",
        accessorFn: (f) => f.ruta.proveedores_count ?? 0,
        sortingFn: sortByNumber((f) => f.ruta.proveedores_count ?? 0),
        enableSorting: true,
        meta: { align: "center", className: "text-sm text-muted-foreground tabular-nums" },
        cell: ({ row }) => row.original.ruta.proveedores_count ?? 0,
      },
      {
        id: "proxima",
        header: "Próxima a vencer",
        accessorFn: (f) => f.ruta.proxima_expiracion,
        sortingFn: sortByDate((f) => f.ruta.proxima_expiracion),
        enableSorting: true,
        meta: { className: "text-sm" },
        cell: ({ row }) => {
          const ruta = row.original.ruta;
          if (!ruta.proxima_expiracion) return <span className="text-muted-foreground">—</span>;
          const dias = diasParaExpirar(ruta as Parameters<typeof computeRutaEstado>[0]);
          const porVencer = dias !== null && dias <= DIAS_POR_VENCER;
          return (
            <span className={porVencer ? "text-destructive font-medium" : "text-muted-foreground"}>
              {porVencer && <AlertTriangle className="inline size-3.5 mr-1" />}
              {formatFecha(ruta.proxima_expiracion)}
            </span>
          );
        },
      },
      {
        id: "actualizacion",
        header: "Última actualización",
        accessorFn: (f) => f.ruta.ultima_actualizacion_tarifa,
        sortingFn: sortByDate((f) => f.ruta.ultima_actualizacion_tarifa),
        enableSorting: true,
        meta: { className: "text-sm text-muted-foreground" },
        cell: ({ row }) => formatFecha(row.original.ruta.ultima_actualizacion_tarifa),
      },
      statusColumn<FilaRuta>({
        id: "estado",
        header: "Estado",
        domain: "ruta_maritima",
        accessor: (f) => f.meta.label,
      }),
      {
        id: "acciones",
        header: "Acciones",
        meta: { width: "w-32", align: "right" },
        cell: ({ row }) => (
          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => navigate(`/costeo/tarifas?ruta=${row.original.ruta.id}`)}
                  aria-label="Ver tarifas de esta ruta"
                >
                  <ExternalLink className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ver tarifas</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onEliminar(row.original.ruta.id)}
                  aria-label="Eliminar ruta"
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Eliminar ruta</TooltipContent>
            </Tooltip>
          </div>
        ),
      },
    ]),
    [navigate, onEliminar],
  );

  return (
    <Card>
      <DataTable<FilaRuta>
        columns={columns}
        data={rutasOrdenadas}
        rowKey={(f) => f.ruta.id}
        isLoading={isLoading}
        onRowClick={(f) => navigate(`/costeo/tarifas?ruta=${f.ruta.id}`)}
        emptyMessage={totalRutas === 0 ? "Sin rutas registradas." : "Sin rutas para el filtro seleccionado."}
      />
    </Card>
  );
}
