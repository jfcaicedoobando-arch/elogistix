/**
 * Bandeja "Por cobrar": facturas vigentes con saldo > 0, no vencidas.
 * Drilldown de fila al detalle del CFDI.
 */
import { useMemo } from "react";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";

interface FilaCobranza {
  id: string;
  numero: string;
  cliente_nombre: string;
  fecha_vencimiento: string;
  saldo: number;
  moneda: string;
  dias_vencido: number;
}

const columns = defineColumns<FilaCobranza>([
  {
    id: "num",
    header: "Folio",
    cell: ({ row }) => <span className="font-mono">{row.original.numero}</span>,
  },
  { id: "cli", header: "Cliente", accessorFn: (r) => r.cliente_nombre },
  {
    id: "fv",
    header: "Vence",
    accessorFn: (r) => r.fecha_vencimiento,
    cell: ({ row }) => formatDate(row.original.fecha_vencimiento),
  },
  {
    id: "sal",
    header: "Saldo",
    meta: { align: "right" },
    accessorFn: (r) => r.saldo,
    cell: ({ row }) => formatCurrency(row.original.saldo, row.original.moneda),
  },
]);

export function BandejaPorCobrar() {
  const { data, isLoading } = useCobranza({ estatus: "todos", moneda: "todas" });
  const filas = useMemo<FilaCobranza[]>(
    () =>
      (data ?? [])
        .filter((f) => f.saldo > 0 && f.estatus_cobranza !== "Vencida")
        .slice()
        .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))
        .slice(0, 200),
    [data],
  );

  return (
    <DataTable
      columns={columns}
      data={filas}
      isLoading={isLoading}
      emptyMessage="Sin saldos por cobrar. ✅"
      rowKey={(r) => r.id}
      getRowHref={(r) => `/facturacion/${r.id}`}
      getRowAriaLabel={(r) => `Abrir factura ${r.numero}`}
    />
  );
}
