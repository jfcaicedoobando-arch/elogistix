/**
 * Bandeja "Vencidas": facturas con vencimiento pasado y saldo > 0.
 * Ordena por días de vencimiento (más vencido primero). Drilldown al detalle.
 */
import { useMemo } from "react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";

interface FilaVencida {
  id: string;
  numero: string;
  cliente_nombre: string;
  fecha_vencimiento: string;
  saldo: number;
  moneda: string;
  dias_vencido: number;
}

function toneDias(d: number): "outline" | "secondary" | "destructive" {
  if (d > 60) return "destructive";
  if (d > 30) return "secondary";
  return "outline";
}

const columns = defineColumns<FilaVencida>([
  {
    id: "num",
    header: "Folio",
    cell: ({ row }) => <span className="font-mono">{row.original.numero}</span>,
  },
  { id: "cli", header: "Cliente", accessorFn: (r) => r.cliente_nombre },
  {
    id: "fv",
    header: "Venció",
    accessorFn: (r) => r.fecha_vencimiento,
    cell: ({ row }) => formatDate(row.original.fecha_vencimiento),
  },
  {
    id: "dv",
    header: "Días",
    accessorFn: (r) => r.dias_vencido,
    cell: ({ row }) => (
      <Badge variant={toneDias(row.original.dias_vencido)}>{row.original.dias_vencido} d</Badge>
    ),
  },
  {
    id: "sal",
    header: "Saldo",
    meta: { align: "right" },
    accessorFn: (r) => r.saldo,
    cell: ({ row }) => formatCurrency(row.original.saldo, row.original.moneda),
  },
]);

export function BandejaVencidas() {
  const { data, isLoading } = useCobranza({ estatus: "todos", moneda: "todas" });
  const filas = useMemo<FilaVencida[]>(
    () =>
      (data ?? [])
        .filter((f) => f.saldo > 0 && f.estatus_cobranza === "Vencida")
        .slice()
        .sort((a, b) => b.dias_vencido - a.dias_vencido)
        .slice(0, 200),
    [data],
  );

  return (
    <DataTable
      columns={columns}
      data={filas}
      isLoading={isLoading}
      emptyMessage="Sin cartera vencida. ✅"
      rowKey={(r) => r.id}
      getRowHref={(r) => `/facturacion/${r.id}`}
      getRowAriaLabel={(r) => `Abrir factura ${r.numero}`}
    />
  );
}
