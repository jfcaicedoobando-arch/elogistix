/**
 * Controller del componente <TabProformas/>: encapsula filtrado, paginación,
 * conteos por estado y construcción de las columnas de la tabla.
 */
import { useState, useMemo } from "react";
import { Download, FileCheck2, FileText, FileCode2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type DataTableColumn } from "@/components/shared/DataTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { useProformas, type ProformaRow, type ProformaConFactura } from "@/hooks/embarque/useProformas";
import { useDescargarProformaPdf } from "@/hooks/embarque/useDescargarProformaPdf";

const DEFAULT_PAGE_SIZE = 20;
export type FiltroEstadoProforma = "todas" | "pendiente" | "facturada";

export function useTabProformasController() {
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoProforma>("todas");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [proformaAFacturar, setProformaAFacturar] = useState<ProformaRow | null>(null);

  const { data: proformas = [], isLoading } = useProformas();
  const { descargar, downloadingId } = useDescargarProformaPdf();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proformas.filter((p) => {
      if (filtroEstado !== "todas" && (p.estado_proforma ?? "pendiente") !== filtroEstado) return false;
      if (!q) return true;
      return (
        p.numero.toLowerCase().includes(q) ||
        p.expediente.toLowerCase().includes(q) ||
        p.cliente_nombre.toLowerCase().includes(q) ||
        (p.folio_factura_externa ?? "").toLowerCase().includes(q)
      );
    });
  }, [proformas, search, filtroEstado]);

  const counts = useMemo(
    () => ({
      todas: proformas.length,
      pendiente: proformas.filter((p) => (p.estado_proforma ?? "pendiente") === "pendiente").length,
      facturada: proformas.filter((p) => p.estado_proforma === "facturada").length,
    }),
    [proformas],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize],
  );

  const columns: DataTableColumn<ProformaConFactura>[] = useMemo(() => [
    {
      key: "numero", header: "# Proforma", width: "w-[140px]", className: "font-medium",
      sticky: true, sortable: true, sortValue: (p) => p.numero, render: (p) => p.numero,
    },
    {
      key: "expediente", header: "Expediente", width: "w-[120px]",
      sortable: true, sortValue: (p) => p.expediente, render: (p) => p.expediente,
    },
    {
      key: "bl_master", header: "BL Master", width: "w-[140px]", className: "text-xs font-mono",
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
    // estado
    search, filtroEstado, page, pageSize,
    setSearch: (v: string) => { setSearch(v); setPage(0); },
    setFiltroEstado: (v: FiltroEstadoProforma) => { setFiltroEstado(v); setPage(0); },
    setPage,
    setPageSize: (s: number) => { setPageSize(s); setPage(0); },
    // datos derivados
    isLoading, proformas, filtered, paginated, counts, totalPages, columns,
    csvColumns, csvRows,
    // dialog facturación
    proformaAFacturar, setProformaAFacturar,
  };
}
