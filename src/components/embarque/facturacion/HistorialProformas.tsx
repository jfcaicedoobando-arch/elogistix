import { Download, FileCode2, FileText, Loader2, Receipt, Trash2 } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { ProformaConFactura } from "@/services/proforma";

interface Props {
  proformas: ProformaConFactura[];
  canEdit: boolean;
  isDeleting: boolean;
  onDescargar: (proformaId: string) => void;
  onEliminar: (id: string, numero: string) => void;
}

export function HistorialProformas({ proformas, canEdit, isDeleting, onDescargar, onEliminar }: Props) {
  const renderEstado = (p: ProformaConFactura) => {
    const facturada = (p.estado_proforma ?? "pendiente") === "facturada";
    const rev = p.estado_revision ?? "aprobada";
    let badgeRevision;
    if (rev === "pendiente") {
      badgeRevision = <Badge variant="warning" className="w-fit">Pendiente de revisión</Badge>;
    } else if (rev === "consolidada") {
      const consolidadaNumero = proformas.find(x => x.id === p.consolidada_en)?.numero;
      badgeRevision = (
        <Badge variant="info" className="w-fit">
          Consolidada{consolidadaNumero ? ` en ${consolidadaNumero}` : ""}
        </Badge>
      );
    } else {
      badgeRevision = <Badge variant="success" className="w-fit">Aprobada</Badge>;
    }
    return (
      <div className="flex flex-col gap-1">
        {badgeRevision}
        {facturada
          ? <Badge variant="success" className="w-fit">Facturada</Badge>
          : <Badge variant="warning" className="w-fit">Pago pendiente</Badge>}
      </div>
    );
  };

  const columns: DataTableColumn<ProformaConFactura>[] = [
    { key: "numero", header: "Número", className: "font-medium", render: (p) => p.numero },
    { key: "fecha", header: "Fecha", render: (p) => formatDate(p.fecha_emision) },
    { key: "operador", header: "Operador", className: "text-sm", render: (p) => p.operador || <span className="text-muted-foreground">—</span> },
    { key: "credito", header: "Días Crédito", align: "right", className: "text-sm",
      render: (p) => p.dias_credito == null ? "—" : Number(p.dias_credito) === 0 ? "Contado" : `${p.dias_credito} días` },
    { key: "usd", header: "Total USD", align: "right",
      render: (p) => Number(p.total_usd) > 0 ? formatCurrency(Number(p.total_usd), "USD") : "—" },
    { key: "mxn", header: "Total MXN", align: "right",
      render: (p) => Number(p.total_mxn) > 0 ? formatCurrency(Number(p.total_mxn), "MXN") : "—" },
    { key: "estado", header: "Estado", render: renderEstado },
    { key: "folio", header: "Folio Factura", className: "text-xs",
      render: (p) => p.folio_factura_externa ? <span className="font-mono">{p.folio_factura_externa}</span> : <span className="text-muted-foreground">—</span> },
    {
      key: "acciones", header: "Acciones", align: "right",
      render: (p) => {
        const facturada = (p.estado_proforma ?? "pendiente") === "facturada";
        return (
          <div className="flex items-center justify-end gap-1">
            <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); onDescargar(p.id); }}>
              <Download className="h-3.5 w-3.5 mr-1" /> Descargar
            </Button>
            {p.facturas?.factura_pdf_url && (
              <Button asChild variant="outline" size="icon" className="h-8 w-8" title="Descargar factura PDF" aria-label="Descargar factura PDF">
                <a href={p.facturas.factura_pdf_url} target="_blank" rel="noopener noreferrer" download onClick={(e) => e.stopPropagation()}>
                  <FileText className="h-3.5 w-3.5 text-destructive" />
                </a>
              </Button>
            )}
            {p.facturas?.factura_xml_url && (
              <Button asChild variant="outline" size="icon" className="h-8 w-8" title="Descargar factura XML" aria-label="Descargar factura XML">
                <a href={p.facturas.factura_xml_url} target="_blank" rel="noopener noreferrer" download onClick={(e) => e.stopPropagation()}>
                  <FileCode2 className="h-3.5 w-3.5 text-info" />
                </a>
              </Button>
            )}
            {canEdit && !facturada && (
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => { e.stopPropagation(); onEliminar(p.id, p.numero); }}
                disabled={isDeleting}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar</>}
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Proformas Generadas</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <DataTable
          columns={columns}
          data={proformas}
          rowKey={(p) => p.id}
          density="compact"
          emptyState={<EmptyStateInline icon={Receipt} message="No hay proformas generadas para este embarque." />}
        />
      </CardContent>
    </Card>
  );
}
