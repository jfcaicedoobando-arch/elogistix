import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Receipt } from "lucide-react";
import { formatCurrency, toTitleCase } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import EmptyState from "@/components/empty/EmptyState";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import type { ConceptoVentaRow, ConceptoCostoRow } from "@/hooks/embarque/useEmbarques";

interface Props {
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  totalVenta: number;
  totalCosto: number;
  utilidad: number;
  margen: number;
}

const kpiColors = [
  'border-l-4 border-l-accent',
  'border-l-4 border-l-warning',
  'border-l-4 border-l-success',
  'border-l-4 border-l-info',
];

const ventaColumns: DataTableColumn<ConceptoVentaRow>[] = [
  { key: "concepto", header: "Concepto", render: (c) => c.descripcion },
  { key: "cant", header: "Cant.", align: "right", className: "tabular-nums", render: (c) => c.cantidad },
  { key: "pu", header: "P. Unitario", align: "right", className: "tabular-nums", render: (c) => formatCurrency(Number(c.precio_unitario), c.moneda) },
  { key: "moneda", header: "Moneda", render: (c) => c.moneda },
  { key: "total", header: "Total", align: "right", className: "font-medium tabular-nums", render: (c) => formatCurrency(Number(c.total), c.moneda) },
];

const costoColumns: DataTableColumn<ConceptoCostoRow>[] = [
  { key: "proveedor", header: "Proveedor", render: (c) => <span title={c.proveedor_nombre}>{toTitleCase(c.proveedor_nombre)}</span> },
  { key: "concepto", header: "Concepto", render: (c) => c.concepto },
  { key: "monto", header: "Monto", align: "right", className: "font-medium tabular-nums", render: (c) => formatCurrency(Number(c.monto), c.moneda) },
  { key: "moneda", header: "Moneda", render: (c) => c.moneda },
  { key: "liq", header: "Liquidación", render: (c) => <Badge className={getEstadoColor(c.estado_liquidacion)}>{c.estado_liquidacion}</Badge> },
];

export function TabCostos({ conceptosVenta, conceptosCosto, totalVenta, totalCosto, utilidad, margen }: Props) {
  const kpis = [
    { label: 'Total Venta', value: formatCurrency(totalVenta), color: '' },
    { label: 'Total Costo', value: formatCurrency(totalCosto), color: '' },
    { label: 'Utilidad', value: formatCurrency(utilidad), color: utilidad >= 0 ? 'text-success' : 'text-destructive' },
    { label: 'Margen', value: `${margen.toFixed(1)}%`, color: margen >= 0 ? 'text-success' : 'text-destructive' },
  ];

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
                <EmptyState icon={Receipt} title="Sin conceptos de venta" description="Aún no se han registrado conceptos de venta para este embarque." />
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
                <EmptyState icon={FileText} title="Sin conceptos de costo" description="Aún no se han registrado conceptos de costo para este embarque." />
              </div>
            }
          />
        </CardContent>
      </Card>
    </div>
  );
}
