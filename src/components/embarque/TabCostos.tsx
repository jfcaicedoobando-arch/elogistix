import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Receipt } from "lucide-react";
import { formatCurrency, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import EmptyState from "@/components/empty/EmptyState";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import type { ConceptoVentaRow, ConceptoCostoRow } from "@/hooks/embarque";

interface Props {
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  totalVenta: number;
  totalCosto: number;
  utilidad: number;
  margen: number;
  embarqueId?: string;
  canEdit?: boolean;
}

const kpiColors = [
  'border-l-4 border-l-accent',
  'border-l-4 border-l-warning',
  'border-l-4 border-l-success',
  'border-l-4 border-l-info',
];

const ventaColumns: ColumnDef<ConceptoVentaRow, unknown>[] = defineColumns<ConceptoVentaRow>([
  { id: "concepto", header: "Concepto", cell: ({ row }) => row.original.descripcion },
  { id: "cant", header: "Cant.", meta: { align: "right", className: "tabular-nums" }, cell: ({ row }) => row.original.cantidad },
  { id: "pu", header: "P. Unitario", meta: { align: "right", className: "tabular-nums" }, cell: ({ row }) => formatCurrency(Number(row.original.precio_unitario), row.original.moneda) },
  { id: "moneda", header: "Moneda", cell: ({ row }) => row.original.moneda },
  { id: "total", header: "Total", meta: { align: "right", className: "font-medium tabular-nums" }, cell: ({ row }) => formatCurrency(Number(row.original.total), row.original.moneda) },
]);

const costoColumns: ColumnDef<ConceptoCostoRow, unknown>[] = defineColumns<ConceptoCostoRow>([
  { id: "proveedor", header: "Proveedor", cell: ({ row }) => <span title={row.original.proveedor_nombre}>{toTitleCase(row.original.proveedor_nombre)}</span> },
  { id: "concepto", header: "Concepto", cell: ({ row }) => row.original.concepto },
  { id: "monto", header: "Monto", meta: { align: "right", className: "font-medium tabular-nums" }, cell: ({ row }) => formatCurrency(Number(row.original.monto), row.original.moneda) },
  { id: "moneda", header: "Moneda", cell: ({ row }) => row.original.moneda },
  { id: "liq", header: "Liquidación", cell: ({ row }) => <Badge className={getEstadoColor(row.original.estado_liquidacion)}>{row.original.estado_liquidacion}</Badge> },
]);

export function TabCostos({ conceptosVenta, conceptosCosto, totalVenta, totalCosto, utilidad, margen, embarqueId, canEdit }: Props) {
  const navigate = useNavigate();
  const kpis = [
    { label: 'Total Venta', value: formatCurrency(totalVenta), color: '' },
    { label: 'Total Costo', value: formatCurrency(totalCosto), color: '' },
    { label: 'Utilidad', value: formatCurrency(utilidad), color: utilidad >= 0 ? 'text-success' : 'text-destructive' },
    { label: 'Margen', value: `${margen.toFixed(1)}%`, color: margen >= 0 ? 'text-success' : 'text-destructive' },
  ];

  const irACargarCostos = canEdit && embarqueId
    ? { label: "Cargar costos", onClick: () => navigate(`/embarques/${embarqueId}/editar?step=3`) }
    : undefined;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <Card key={kpi.label} className={kpiColors[i]}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-lg font-bold mt-1 tabular-nums ${kpi.color}`}>{kpi.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos de Venta</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={ventaColumns}
            data={conceptosVenta}
            rowKey={(c) => c.id}
            density="compact"
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={Receipt}
                  title="Sin conceptos de venta"
                  description={irACargarCostos ? "Haz clic en el ícono o en el botón para capturar los conceptos de venta." : "Aún no se han registrado conceptos de venta para este embarque."}
                  primaryAction={irACargarCostos}
                />
              </div>
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos de Costo</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={costoColumns}
            data={conceptosCosto}
            rowKey={(c) => c.id}
            density="compact"
            emptyState={
              <div className="p-6">
                <EmptyState
                  icon={FileText}
                  title="Sin conceptos de costo"
                  description={irACargarCostos ? "Haz clic en el ícono o en el botón para capturar los costos del embarque." : "Aún no se han registrado conceptos de costo para este embarque."}
                  primaryAction={irACargarCostos}
                />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
