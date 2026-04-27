/**
 * Controller del componente <TabProformas/>: orquesta el estado UI (delegado a
 * `useTabProformasState`), las columnas de tabla y la integración con
 * descarga de PDF + dialog de facturación.
 */
import { useState, useMemo } from "react";
import { Download, FileCheck2, FileText, FileCode2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DataTableColumn } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useProformas, type ProformaRow, type ProformaConFactura } from "@/hooks/embarque/useProformas";
import { useDescargarProformaPdf } from "@/hooks/embarque/useDescargarProformaPdf";
import { useTabProformasState, type FiltroEstadoProforma } from "./useTabProformasState";

export type { FiltroEstadoProforma };

export function useTabProformasController() {
  const [proformaAFacturar, setProformaAFacturar] = useState<ProformaRow | null>(null);

  const { data: proformas = [], isLoading } = useProformas();
  const { descargar, downloadingId } = useDescargarProformaPdf();

  const state = useTabProformasState(proformas);
  const { filtered, paginated, counts, totalPages, search, filtroEstado, page, pageSize } = state;


  const columns: DataTableColumn<ProformaConFactura>[] = useMemo(() => [
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
            <Badge variant="info">Consolidada{n > 0 ? ` (${n})` : ""}</Badge>
          );
        }
        return <Badge variant="neutral">Individual</Badge>;
      },
    },
    {
      key: "cliente", header: "Cliente", width: "min-w-[180px]", className: "max-w-[220px] truncate",
      sortable: true, sortValue: (p) => p.cliente_nombre, render: (p) => p.cliente_nombre,
    },
    {
      key: "operador", header: "Operador", width: "w-[140px]", className: "text-xs",
      sortable: true, sortValue: (p) => p.operador || "",
      render: (p) => p.operador || <span className="text-muted-foreground">—</span>,
    },
    {
      key: "dias_credito", header: "Días Crédito", width: "w-[110px]", className: "text-right text-xs",
      sortable: true, sortValue: (p) => p.dias_credito ?? -1,
      render: (p) =>
        p.dias_credito == null ? "—" : Number(p.dias_credito) === 0 ? "Contado" : `${p.dias_credito} días`,
    },
    {
      key: "monto_usd", header: "Monto USD", width: "w-[120px]", className: "text-right",
      sortable: true, sortValue: (p) => Number(p.total_usd),
      render: (p) => (Number(p.total_usd) > 0 ? formatCurrency(Number(p.total_usd), "USD") : "—"),
    },
    {
      key: "monto_mxn", header: "Monto MXN", width: "w-[120px]", className: "text-right",
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
                onClick={(e) => { e.stopPropagation(); setProformaAFacturar(p); }}
              >
                <FileCheck2 className="h-3.5 w-3.5 mr-1" /> Facturada
              </Button>
            )}
          </div>
        );
      },
    },
  ], [descargar, downloadingId]);

  const csvColumns = [
    { key: "numero", label: "# Proforma" },
    { key: "expediente", label: "Expediente" },
    { key: "cliente", label: "Cliente" },
    { key: "operador", label: "Operador" },
    { key: "dias_credito", label: "Días Crédito" },
    { key: "subtotal_usd", label: "Subtotal USD" },
    { key: "iva_usd", label: "IVA USD" },
    { key: "total_usd", label: "Total USD" },
    { key: "subtotal_mxn", label: "Subtotal MXN" },
    { key: "iva_mxn", label: "IVA MXN" },
    { key: "total_mxn", label: "Total MXN" },
    { key: "fecha", label: "Fecha" },
    { key: "estado", label: "Estado" },
    { key: "folio_factura", label: "Folio Factura" },
    { key: "fecha_facturacion", label: "Fecha Facturación" },
  ];

  const csvRows = () => filtered.map((p) => ({
    numero: p.numero, expediente: p.expediente, cliente: p.cliente_nombre,
    operador: p.operador ?? "", dias_credito: p.dias_credito ?? "",
    subtotal_usd: Number(p.subtotal_usd), iva_usd: Number(p.iva_usd), total_usd: Number(p.total_usd),
    subtotal_mxn: Number(p.subtotal_mxn), iva_mxn: Number(p.iva_mxn), total_mxn: Number(p.total_mxn),
    fecha: p.fecha_emision, estado: p.estado_proforma ?? "pendiente",
    folio_factura: p.folio_factura_externa ?? "", fecha_facturacion: p.fecha_facturacion ?? "",
  }));

  return {
    // estado (delegado a useTabProformasState)
    search, filtroEstado, page, pageSize,
    setSearch: state.setSearch,
    setFiltroEstado: state.setFiltroEstado,
    setPage: state.setPage,
    setPageSize: state.setPageSize,
    // datos derivados
    isLoading, proformas, filtered, paginated, counts, totalPages, columns,
    csvColumns, csvRows,
    // dialog facturación
    proformaAFacturar, setProformaAFacturar,
  };
}
