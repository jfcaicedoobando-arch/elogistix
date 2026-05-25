import { Link } from "react-router-dom";
import { FileX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import EmptyState from "@/components/empty/EmptyState";
import { formatCurrency, toTitleCase, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";

export interface ProveedorOperacion {
  embarqueId: string;
  expediente: string;
  clienteNombre: string;
  concepto: string;
  monto: number;
  moneda: string;
  estadoLiquidacion: string;
  fechaVencimiento: string | null;
}

interface Props {
  operaciones: ProveedorOperacion[];
}

export function ProveedorOperacionesTable({ operaciones }: Props) {
  type Op = ProveedorOperacion & { __idx?: number };
  const opsConId: Op[] = operaciones.map((o, i) => ({ ...o, __idx: i }));
  const opCols: ColumnDef<Op, unknown>[] = defineColumns<Op>([
    {
      id: "exp",
      header: "Expediente",
      cell: ({ row }) => (
        <Link to={`/embarques/${row.original.embarqueId}`} className="text-primary hover:underline font-medium text-xs" onClick={(e) => e.stopPropagation()}>{row.original.expediente}</Link>
      ),
    },
    { id: "cliente", header: "Cliente", meta: { className: "text-xs" }, cell: ({ row }) => <span title={row.original.clienteNombre}>{toTitleCase(row.original.clienteNombre)}</span> },
    { id: "concepto", header: "Concepto", meta: { className: "text-xs" }, cell: ({ row }) => toTitleCase(row.original.concepto) },
    { id: "monto", header: "Monto", meta: { align: "right", className: "text-xs font-medium tabular-nums" }, cell: ({ row }) => formatCurrency(row.original.monto, row.original.moneda) },
    { id: "estado", header: "Estado", cell: ({ row }) => <Badge className={`text-xs ${getEstadoColor(row.original.estadoLiquidacion)}`}>{row.original.estadoLiquidacion}</Badge> },
    { id: "venc", header: "Vencimiento", meta: { className: "text-xs" }, cell: ({ row }) => row.original.fechaVencimiento ? formatDate(row.original.fechaVencimiento) : '—' },
  ]);
  return (
    <DataTable
      columns={opCols}
      data={opsConId}
      rowKey={(o) => `${o.embarqueId}-${o.__idx}`}
      density="compact"
      emptyState={
        <div className="p-6">
          <EmptyState
            icon={FileX}
            title="Sin operaciones registradas"
            description="Cuando este proveedor aparezca en costos de embarques, las operaciones se mostrarán aquí."
          />
        </div>
      }
    />
  );
}
