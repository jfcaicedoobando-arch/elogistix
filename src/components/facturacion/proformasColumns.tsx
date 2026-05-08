/**
 * Definición de columnas JSX del tab de Proformas. Se mantiene fuera del hook
 * controller para respetar la separación lógica/presentación: el hook expone
 * datos + handlers, este builder los compone con celdas visuales.
 */
import { Download, FileCheck2, FileText, FileCode2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DataTableColumn } from "@/components/shared/DataTable";
import { formatCurrency, formatDate, toTitleCase, nombreDesdeEmail } from "@/lib/formatters";
import type { ProformaConFactura, ProformaRow } from "@/hooks/embarque/useProformas";

interface BuildArgs {
  descargar: (p: ProformaConFactura) => void;
  downloadingId: string | null;
  onMarcarFacturada: (p: ProformaRow) => void;
}

export function buildProformasColumns({
  descargar,
  downloadingId,
  onMarcarFacturada,
}: BuildArgs): DataTableColumn<ProformaConFactura>[] {
  return [
    {
      key: "numero", header: "# Proforma", width: "w-[140px]", className: "font-medium whitespace-nowrap",
      sticky: true, sortable: true, sortValue: (p) => p.numero, render: (p) => p.numero,
    },
    {
      key: "expediente", header: "Expediente", width: "w-[120px]", className: "whitespace-nowrap",
      sortable: true, sortValue: (p) => p.expediente, render: (p) => p.expediente,
    },
    {
      key: "bl_master", header: "BL Master", width: "w-[140px]", className: "text-xs font-mono whitespace-nowrap",
      sortable: true, sortValue: (p) => p.bl_master ?? "",
      render: (p) => p.bl_master || <span className="text-muted-foreground">—</span>,
    },
    {
      key: "tipo", header: "Tipo", width: "w-[140px]", sortable: true,
      sortValue: (p) => (p.es_consolidada ? `Consolidada-${p.proformas_origen?.length ?? 0}` : "Individual"),
      render: (p) => {
        if (p.es_consolidada) {
          const n = p.proformas_origen?.length ?? 0;
          return (
            <Badge variant="info" className="whitespace-nowrap">Consolidada{n > 0 ? ` (${n})` : ""}</Badge>
          );
        }
        return <Badge variant="neutral" className="whitespace-nowrap">Individual</Badge>;
      },
    },
    {
      key: "cliente", header: "Cliente", width: "min-w-[180px]", className: "max-w-[220px] truncate",
      sortable: true, sortValue: (p) => p.cliente_nombre,
      render: (p) => <span title={toTitleCase(p.cliente_nombre)}>{toTitleCase(p.cliente_nombre)}</span>,
    },
    {
      key: "operador", header: "Operador", width: "w-[140px]", className: "text-xs whitespace-nowrap",
      sortable: true, sortValue: (p) => p.operador || "",
      render: (p) => p.operador ? nombreDesdeEmail(p.operador) : <span className="text-muted-foreground">—</span>,
    },
    {
      key: "dias_credito", header: "Días Crédito", width: "w-[110px]", className: "text-right text-xs whitespace-nowrap",
      sortable: true, sortValue: (p) => p.dias_credito ?? -1,
      render: (p) =>
        p.dias_credito == null ? "—" : Number(p.dias_credito) === 0 ? "Contado" : `${p.dias_credito} días`,
    },
    {
      key: "monto_usd", header: "Monto USD", width: "w-[130px]", className: "text-right whitespace-nowrap",
      sortable: true, sortValue: (p) => Number(p.total_usd),
      render: (p) => (Number(p.total_usd) > 0 ? formatCurrency(Number(p.total_usd), "USD") : "—"),
    },
    {
      key: "monto_mxn", header: "Monto MXN", width: "w-[140px]", className: "text-right whitespace-nowrap",
      sortable: true, sortValue: (p) => Number(p.total_mxn),
      render: (p) => (Number(p.total_mxn) > 0 ? formatCurrency(Number(p.total_mxn), "MXN") : "—"),
    },
    {
      key: "fecha", header: "Fecha", width: "w-[100px]", className: "text-xs",
      sortable: true, sortValue: (p) => p.fecha_emision, render: (p) => formatDate(p.fecha_emision),
    },
    {
      key: "estado", header: "Estado", width: "w-[110px]",
      sortable: true, sortValue: (p) => p.estado_proforma ?? "pendiente",
      render: (p) => {
        const estado = p.estado_proforma ?? "pendiente";
        return estado === "facturada"
          ? <Badge variant="success">Facturada</Badge>
          : <Badge variant="warning">Pendiente</Badge>;
      },
    },
    {
      key: "folio_factura", header: "Folio Factura", width: "w-[180px]", className: "text-xs",
      sortable: true, sortValue: (p) => p.folio_factura_externa ?? "",
      render: (p) => {
        if (!p.folio_factura_externa) return <span className="text-muted-foreground">—</span>;
        const pdfUrl = p.facturas?.factura_pdf_url;
        const xmlUrl = p.facturas?.factura_xml_url;
        return (
          <div className="flex items-center gap-1">
            <span className="font-mono">{p.folio_factura_externa}</span>
            {pdfUrl && (
              <a href={pdfUrl} target="_blank" rel="noopener noreferrer" download
                title="Descargar PDF" onClick={(e) => e.stopPropagation()}>
                <FileText className="h-3.5 w-3.5 text-destructive hover:opacity-80" />
              </a>
            )}
            {xmlUrl && (
              <a href={xmlUrl} target="_blank" rel="noopener noreferrer" download
                title="Descargar XML" onClick={(e) => e.stopPropagation()}>
                <FileCode2 className="h-3.5 w-3.5 text-info hover:opacity-80" />
              </a>
            )}
          </div>
        );
      },
    },
    {
      key: "acciones", header: "Acciones", width: "w-[200px]",
      render: (p) => {
        const facturada = (p.estado_proforma ?? "pendiente") === "facturada";
        return (
          <div className="flex items-center gap-1">
            <Button
              variant="outline" size="sm" disabled={downloadingId === p.id}
              onClick={(e) => { e.stopPropagation(); descargar(p); }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> PDF
            </Button>
            {!facturada && (
              <Button
                variant="default" size="sm"
                onClick={(e) => { e.stopPropagation(); onMarcarFacturada(p); }}
              >
                <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Facturada
              </Button>
            )}
          </div>
        );
      },
    },
  ];
}
