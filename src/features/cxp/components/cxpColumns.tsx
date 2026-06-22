import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DollarSign, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import type { FacturaCxP, EstatusCxP } from "@/features/cxp/services";

const ESTATUS_COLOR: Record<EstatusCxP, string> = {
  Vigente: "bg-success/10 text-success border-success/20",
  "Por vencer": "bg-warning/10 text-warning border-warning/20",
  Vencida: "bg-destructive/10 text-destructive border-destructive/20",
  Pagada: "bg-muted text-muted-foreground border-border",
  "Sin saldo": "bg-muted text-muted-foreground border-border",
};
type EstadoAprob = "pendiente" | "aprobada" | "rechazada";
const APROB_COLOR: Record<EstadoAprob, string> = {
  pendiente: "bg-warning/10 text-warning border-warning/20",
  aprobada: "bg-success/10 text-success border-success/20",
  rechazada: "bg-destructive/10 text-destructive border-destructive/20",
};
const APROB_LABEL: Record<EstadoAprob, string> = { pendiente: "Por aprobar", aprobada: "Aprobada", rechazada: "Rechazada" };

export interface CxPColumnsOptions {
  canEdit: boolean;
  onRegistrarPago: (f: FacturaCxP) => void;
  onVerDetalle: (f: FacturaCxP) => void;
  onEliminar: (f: FacturaCxP) => void;
}

export function buildCxPColumns(opts: CxPColumnsOptions): ColumnDef<FacturaCxP, unknown>[] {
  const { canEdit, onRegistrarPago, onVerDetalle, onEliminar } = opts;
  return defineColumns<FacturaCxP>([
    {
      id: "folio", header: "Folio proveedor",
      accessorFn: (f) => f.folio_proveedor, enableSorting: true,
      sortingFn: sortByString<FacturaCxP>((f) => f.folio_proveedor),
      meta: { width: "w-[140px]", className: "font-medium whitespace-nowrap" },
      cell: ({ row }) => row.original.folio_proveedor,
    },
    {
      id: "proveedor", header: "Proveedor",
      meta: { width: "min-w-[160px]", className: "max-w-[220px]" },
      cell: ({ row }) => {
        const origen = row.original.proveedor_origen;
        const badgeCls = origen === "Nacional"
          ? "bg-primary/10 text-primary border-primary/20"
          : origen === "Extranjero"
            ? "bg-warning/10 text-warning border-warning/20"
            : "";
        return (
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="truncate" title={toTitleCase(row.original.proveedor_nombre)}>
              {toTitleCase(row.original.proveedor_nombre)}
            </span>
            {origen && (
              <Badge variant="outline" className={`${badgeCls} text-[10px] px-1.5 py-0 h-4 w-fit font-normal`}>
                {origen}
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      id: "emision", header: "Emisión",
      accessorFn: (f) => f.fecha_emision, enableSorting: true,
      sortingFn: sortByDate<FacturaCxP>((f) => f.fecha_emision),
      meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.fecha_emision),
    },
    {
      id: "vencimiento", header: "Vencimiento",
      accessorFn: (f) => f.fecha_vencimiento ?? "", enableSorting: true,
      sortingFn: sortByDate<FacturaCxP>((f) => f.fecha_vencimiento ?? ""),
      meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => row.original.fecha_vencimiento ? formatDate(row.original.fecha_vencimiento) : "—",
    },
    {
      id: "dias", header: "Días vencido",
      accessorFn: (f) => f.dias_vencido, enableSorting: true,
      sortingFn: sortByNumber<FacturaCxP>((f) => f.dias_vencido),
      meta: { width: "w-[90px]", align: "right", className: "tabular-nums text-xs" },
      cell: ({ row }) => {
        const f = row.original;
        const saldada = f.estatus === "Pagada" || f.estatus === "Sin saldo";
        if (saldada || f.dias_vencido <= 0) return <span className="text-muted-foreground">—</span>;
        return <span className="text-destructive font-medium">{f.dias_vencido}</span>;
      },
    },
    {
      id: "moneda", header: "Mon.",
      meta: { width: "w-[60px]", className: "text-xs" },
      cell: ({ row }) => row.original.moneda,
    },
    {
      id: "total", header: "Total",
      accessorFn: (f) => f.total, enableSorting: true,
      sortingFn: sortByNumber<FacturaCxP>((f) => f.total),
      meta: { width: "w-[120px]", align: "right", className: "tabular-nums whitespace-nowrap" },
      cell: ({ row }) => formatCurrency(row.original.total, row.original.moneda),
    },
    {
      id: "pagado", header: "Pagado",
      accessorFn: (f) => f.pagado, enableSorting: true,
      sortingFn: sortByNumber<FacturaCxP>((f) => f.pagado),
      meta: { width: "w-[120px]", align: "right", className: "tabular-nums whitespace-nowrap text-success" },
      cell: ({ row }) => formatCurrency(row.original.pagado, row.original.moneda),
    },
    {
      id: "saldo", header: "Saldo",
      accessorFn: (f) => f.saldo, enableSorting: true,
      sortingFn: sortByNumber<FacturaCxP>((f) => f.saldo),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
      cell: ({ row }) => formatCurrency(row.original.saldo, row.original.moneda),
    },
    {
      id: "estatus", header: "Estatus",
      accessorFn: (f) => f.estatus, enableSorting: true,
      sortingFn: sortByString<FacturaCxP>((f) => f.estatus),
      meta: { width: "w-[110px]" },
      cell: ({ row }) => (
        <Badge variant="outline" className={ESTATUS_COLOR[row.original.estatus]}>
          {row.original.estatus}
        </Badge>
      ),
    },
    {
      id: "aprobacion", header: "Aprobación",
      accessorFn: (f) => f.estado_aprobacion, enableSorting: true,
      sortingFn: sortByString<FacturaCxP>((f) => f.estado_aprobacion),
      meta: { width: "w-[110px]" },
      cell: ({ row }) => {
        const ap = row.original.estado_aprobacion;
        return (
          <Badge
            variant="outline"
            className={APROB_COLOR[ap]}
            title={ap === "rechazada" && row.original.motivo_rechazo ? row.original.motivo_rechazo : undefined}
          >
            {APROB_LABEL[ap]}
          </Badge>
        );
      },
    },
    {
      id: "acciones", header: "Acciones",
      meta: { width: "w-[150px]" },
      cell: ({ row }) => {
        const f = row.original;
        const aprobada = f.estado_aprobacion === "aprobada";
        const pagable = canEdit && f.saldo > 0 && f.estado !== "Borrador";
        const pagoBloqueado = pagable && !aprobada;
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {pagable && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRegistrarPago(f)}
                disabled={!aprobada}
                title={pagoBloqueado ? "Requiere aprobación antes de pagar" : "Registrar pago"}
              >
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Pagar
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" title="Más acciones">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                <DropdownMenuItem onClick={() => onVerDetalle(f)}>
                  <Eye className="h-4 w-4 mr-2" /> Ver detalle de pagos
                </DropdownMenuItem>
                {canEdit && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onEliminar(f)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" /> Eliminar factura
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ]);
}
