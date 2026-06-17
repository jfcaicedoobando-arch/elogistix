import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, FileMinus, Eye, Bell, BellRing } from "lucide-react";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import type { FacturaCobranza, EstatusCobranza } from "@/features/facturacion/services";
import type { UltimoRecordatorio } from "@/features/facturacion/services/recordatorios";

const ESTATUS_COLOR: Record<EstatusCobranza, string> = {
  Vigente: "bg-success/10 text-success border-success/20",
  "Por vencer": "bg-warning/10 text-warning border-warning/20",
  Vencida: "bg-destructive/10 text-destructive border-destructive/20",
  Pagada: "bg-muted text-muted-foreground border-border",
  "Sin saldo": "bg-muted text-muted-foreground border-border",
};

function diasDesde(iso: string): number {
  const d = new Date(iso);
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

export interface CobranzaColumnsOptions {
  canEdit: boolean;
  onRegistrarPago: (f: FacturaCobranza) => void;
  onCrearNC: (f: FacturaCobranza) => void;
  onVerDetalle: (f: FacturaCobranza) => void;
  onEnviarRecordatorio: (f: FacturaCobranza) => void;
  recordatoriosMap?: Map<string, UltimoRecordatorio>;
  recordatorioPendingId?: string | null;
}

export function buildCobranzaColumns(opts: CobranzaColumnsOptions): ColumnDef<FacturaCobranza, unknown>[] {
  const { canEdit, onRegistrarPago, onCrearNC, onVerDetalle, onEnviarRecordatorio, recordatoriosMap, recordatorioPendingId } = opts;
  return defineColumns<FacturaCobranza>([
    {
      id: "numero", header: "# Factura",
      accessorFn: (f) => f.numero, enableSorting: true,
      sortingFn: sortByString<FacturaCobranza>((f) => f.numero),
      meta: { width: "w-[110px]", className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => (
        <Link
          to={`/facturacion/${row.original.id}`}
          onClick={(e) => e.stopPropagation()}
          className="text-accent hover:underline"
        >
          {row.original.numero}
        </Link>
      ),
    },
    {
      id: "cliente", header: "Cliente",
      meta: { width: "min-w-[160px]", className: "max-w-[220px] truncate" },
      cell: ({ row }) => <span title={toTitleCase(row.original.cliente_nombre)}>{toTitleCase(row.original.cliente_nombre)}</span>,
    },
    {
      id: "emision", header: "Emisión",
      accessorFn: (f) => f.fecha_emision, enableSorting: true,
      sortingFn: sortByDate<FacturaCobranza>((f) => f.fecha_emision),
      meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.fecha_emision),
    },
    {
      id: "vencimiento", header: "Vencimiento",
      accessorFn: (f) => f.fecha_vencimiento, enableSorting: true,
      sortingFn: sortByDate<FacturaCobranza>((f) => f.fecha_vencimiento),
      meta: { width: "w-[100px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => formatDate(row.original.fecha_vencimiento),
    },
    {
      id: "dias", header: "Días vencido",
      accessorFn: (f) => f.dias_vencido, enableSorting: true,
      sortingFn: sortByNumber<FacturaCobranza>((f) => f.dias_vencido),
      meta: { width: "w-[90px]", align: "right", className: "tabular-nums text-xs" },
      cell: ({ row }) => row.original.dias_vencido > 0
        ? <span className="text-destructive font-medium">{row.original.dias_vencido}</span>
        : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "moneda", header: "Mon.",
      meta: { width: "w-[60px]", className: "text-xs" },
      cell: ({ row }) => row.original.moneda,
    },
    {
      id: "total", header: "Total",
      accessorFn: (f) => f.total, enableSorting: true,
      sortingFn: sortByNumber<FacturaCobranza>((f) => f.total),
      meta: { width: "w-[120px]", align: "right", className: "tabular-nums whitespace-nowrap" },
      cell: ({ row }) => formatCurrency(row.original.total, row.original.moneda),
    },
    {
      id: "pagado", header: "Pagado",
      accessorFn: (f) => f.pagado, enableSorting: true,
      sortingFn: sortByNumber<FacturaCobranza>((f) => f.pagado),
      meta: { width: "w-[120px]", align: "right", className: "tabular-nums whitespace-nowrap text-success" },
      cell: ({ row }) => formatCurrency(row.original.pagado, row.original.moneda),
    },
    {
      id: "saldo", header: "Saldo",
      accessorFn: (f) => f.saldo, enableSorting: true,
      sortingFn: sortByNumber<FacturaCobranza>((f) => f.saldo),
      meta: { width: "w-[130px]", align: "right", className: "tabular-nums whitespace-nowrap font-semibold" },
      cell: ({ row }) => (
        <span className={row.original.saldo > 0 ? "text-foreground" : "text-muted-foreground"}>
          {formatCurrency(row.original.saldo, row.original.moneda)}
        </span>
      ),
    },
    {
      id: "estatus", header: "Estatus",
      accessorFn: (f) => f.estatus_cobranza, enableSorting: true,
      sortingFn: sortByString<FacturaCobranza>((f) => f.estatus_cobranza),
      meta: { width: "w-[110px]" },
      cell: ({ row }) => (
        <Badge variant="outline" className={ESTATUS_COLOR[row.original.estatus_cobranza]}>
          {row.original.estatus_cobranza}
        </Badge>
      ),
    },
    {
      id: "recordatorio", header: "Último recordatorio",
      meta: { width: "w-[150px]", className: "text-xs" },
      cell: ({ row }) => {
        const ult = recordatoriosMap?.get(row.original.id);
        if (!ult) return <span className="text-muted-foreground">—</span>;
        const dias = diasDesde(ult.fecha);
        const tone = dias > 14 ? "text-warning" : "text-muted-foreground";
        return (
          <span className={tone} title={`${ult.canal} · ${formatDate(ult.fecha)}`}>
            {formatDate(ult.fecha)} <span className="opacity-60">({dias}d)</span>
          </span>
        );
      },
    },
    {
      id: "acciones", header: "Acciones",
      meta: { width: "w-[200px]" },
      cell: ({ row }) => {
        const f = row.original;
        const cobrable = canEdit && f.saldo > 0;
        const pending = recordatorioPendingId === f.id;
        const hasRec = !!recordatoriosMap?.get(f.id);
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {cobrable && (
              <Button variant="outline" size="sm" onClick={() => onRegistrarPago(f)} title="Registrar pago">
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Pagar
              </Button>
            )}
            {canEdit && f.saldo > 0 && (
              <Button
                variant="ghost" size="icon"
                onClick={() => onEnviarRecordatorio(f)}
                disabled={pending}
                title={hasRec ? "Registrar nuevo recordatorio" : "Enviar recordatorio"}
              >
                {hasRec
                  ? <BellRing className="h-4 w-4 text-warning" />
                  : <Bell className="h-4 w-4" />}
              </Button>
            )}
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => onCrearNC(f)} title="Nota de crédito">
                <FileMinus className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => onVerDetalle(f)} title="Ver detalle">
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ]);
}
