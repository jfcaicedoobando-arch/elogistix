import { useMemo, useState } from "react";
import { FileX } from "lucide-react";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { statusColumn } from "@/components/shared/dataTable/columnBuilders";
import EmptyState from "@/components/empty/EmptyState";
import { formatCurrency, toTitleCase, formatDate } from "@/lib/formatters";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

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

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

/**
 * Tabla de operaciones de un proveedor.
 *
 * v13.56.5 — Paginación defensiva en cliente. El servicio limita el fetch
 * a 1000 filas y la UI nunca renderiza más de `pageSize` (default 50) para
 * mantener fluido el detalle de proveedores con mucho histórico.
 */
export function ProveedorOperacionesTable({ operaciones }: Props) {
  type Op = ProveedorOperacion & { __idx?: number };
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const opsConId: Op[] = useMemo(
    () => operaciones.map((o, i) => ({ ...o, __idx: i })),
    [operaciones],
  );
  const totalPages = Math.max(1, Math.ceil(opsConId.length / pageSize));
  const pageItems = useMemo(
    () => opsConId.slice(page * pageSize, (page + 1) * pageSize),
    [opsConId, page, pageSize],
  );

  const opCols: ColumnDef<Op, unknown>[] = defineColumns<Op>([
    {
      id: "exp",
      header: "Expediente",
      cell: ({ row }) => (
        <span className="font-medium text-xs">{row.original.expediente}</span>
      ),
    },
    { id: "cliente", header: "Cliente", meta: { className: "text-xs" }, cell: ({ row }) => <span title={row.original.clienteNombre}>{toTitleCase(row.original.clienteNombre)}</span> },
    { id: "concepto", header: "Concepto", meta: { className: "text-xs" }, cell: ({ row }) => toTitleCase(row.original.concepto) },
    { id: "monto", header: "Monto", meta: { align: "right", className: "text-xs font-medium tabular-nums" }, cell: ({ row }) => formatCurrency(row.original.monto, row.original.moneda) },
    statusColumn<Op>({ id: "estado", header: "Estado", domain: "liquidacion", accessor: (o) => o.estadoLiquidacion }),
    { id: "venc", header: "Vencimiento", meta: { className: "text-xs" }, cell: ({ row }) => row.original.fechaVencimiento ? formatDate(row.original.fechaVencimiento) : '—' },
  ]);
  return (
    <DataTable
      columns={opCols}
      data={pageItems}
      getRowHref={(o) => `/embarques/${o.embarqueId}`}
      rowKey={(o) => `${o.embarqueId}-${o.__idx}`}
      density={TABLE_DENSITY.embebida}
      pagination={{
        page,
        totalPages,
        onPageChange: setPage,
        pageSize,
        onPageSizeChange: (s: number) => { setPageSize(s); setPage(0); },
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        total: opsConId.length,
      }}
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
