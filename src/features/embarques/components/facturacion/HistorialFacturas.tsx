import { ChevronRight, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import type { ProformaConFactura } from "@/features/proformas/services";

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
  const navigate = useNavigate();

  const columns: ColumnDef<Factura, unknown>[] = defineColumns<Factura>([
    { id: "numero", header: "# Factura", meta: { className: "font-medium" }, cell: ({ row }) => row.original.numero },
    {
      id: "proforma",
      header: "Proforma",
      meta: { className: "text-xs" },
      cell: ({ row }) => {
        const f = row.original;
        if (!f.proforma_id) return <span className="text-muted-foreground">—</span>;
        const num = proformas.find(p => p.id === f.proforma_id)?.numero;
        if (!num) return <span className="text-muted-foreground">—</span>;
        return (
          <Button
            variant="link"
            className="h-auto p-0 font-mono text-info"
            onClick={(e) => { e.stopPropagation(); navigate(`/proformas/${f.proforma_id}`); }}
          >
            {num}
          </Button>
        );
      },
    },
    {
      id: "monto",
      header: "Monto",
      meta: { align: "right", className: "tabular-nums" },
      cell: ({ row }) => formatCurrency(Number(row.original.total), row.original.moneda),
    },
    { id: "fecha", header: "Fecha", cell: ({ row }) => formatDate(row.original.fecha_emision) },
    {
      id: "estado",
      header: "Estado",
      cell: ({ row }) => <Badge className={getEstadoColor(row.original.estado)}>{row.original.estado}</Badge>,
    },
    {
      id: "chevron",
      header: "",
      meta: { align: "right", className: "w-8" },
      cell: () => <ChevronRight className="h-4 w-4 text-muted-foreground/40 ml-auto" />,
    },
  ]);

  const totalEmitido = facturas.reduce((acc, f) => acc + Number(f.total), 0);

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <CardTitle >Facturas del Embarque</CardTitle>
        {facturas.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {facturas.length} factura{facturas.length === 1 ? "" : "s"}
            {totalEmitido > 0 && facturas[0]?.moneda && (
              <> · {formatCurrency(totalEmitido, facturas[0].moneda)}</>
            )}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={facturas}
          rowKey={(f) => f.id}
          density="compact"
          getRowHref={(f) => `/facturacion/${f.id}`}
          rowClassName={() => "cursor-pointer hover:bg-muted/40"}
          emptyIcon={Receipt}
          emptyMessage="No hay facturas generadas para este embarque."
        />
      </CardContent>
    </Card>
  );
}
