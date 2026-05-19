import { Receipt } from "lucide-react";
import { FacturaDownloadButton } from "@/components/facturacion/FacturaDownloadButton";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import type { ProformaConFactura } from "@/services/proforma";

interface Factura {
  id: string;
  numero: string;
  total: number;
  moneda: string;
  fecha_emision: string;
  estado: string;
  proforma_id?: string | null;
  factura_pdf_url?: string | null;
  factura_xml_url?: string | null;
}

interface Props {
  facturas: Factura[];
  proformas: ProformaConFactura[];
}

export function HistorialFacturas({ facturas, proformas }: Props) {
  const columns: ColumnDef<Factura, unknown>[] = defineColumns<Factura>([
    { id: "numero", header: "# Factura", meta: { className: "font-medium" }, cell: ({ row }) => row.original.numero },
    {
      id: "proforma",
      header: "Proforma",
      meta: { className: "text-xs" },
      cell: ({ row }) => {
        const f = row.original;
        const num = f.proforma_id ? proformas.find(p => p.id === f.proforma_id)?.numero : null;
        return num ? <span className="font-mono">{num}</span> : <span className="text-muted-foreground">—</span>;
      },
    },
    { id: "monto", header: "Monto", meta: { align: "right", className: "tabular-nums" }, cell: ({ row }) => formatCurrency(Number(row.original.total), row.original.moneda) },
    { id: "moneda", header: "Moneda", cell: ({ row }) => row.original.moneda },
    { id: "fecha", header: "Fecha", cell: ({ row }) => formatDate(row.original.fecha_emision) },
    { id: "estado", header: "Estado", cell: ({ row }) => <Badge className={getEstadoColor(row.original.estado)}>{row.original.estado}</Badge> },
    {
      id: "archivos",
      header: "Archivos",
      cell: ({ row }) => {
        const f = row.original;
        return (!f.factura_pdf_url && !f.factura_xml_url) ? (
          <span className="text-muted-foreground text-xs">—</span>
        ) : (
          <div className="flex items-center gap-1">
            {f.factura_pdf_url && <FacturaDownloadButton stored={f.factura_pdf_url} kind="pdf" />}
            {f.factura_xml_url && <FacturaDownloadButton stored={f.factura_xml_url} kind="xml" />}
          </div>
        );
      },
    },
  ]);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-sm">Facturas del Embarque</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={facturas}
          rowKey={(f) => f.id}
          density="compact"
          emptyState={<EmptyStateInline icon={Receipt} message="No hay facturas generadas para este embarque." />}
        />
      </CardContent>
    </Card>
  );
}
