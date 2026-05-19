/**
 * Definición de columnas JSX del tab de Proformas (Fase 2 — ColumnDef nativo).
 * Se mantiene fuera del hook controller para respetar la separación
 * lógica/presentación: el hook expone datos + handlers, este builder los
 * compone con celdas visuales.
 */
import { Download, FileCheck2 } from "lucide-react";
import { FacturaDownloadButton } from "@/components/facturacion/FacturaDownloadButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency, formatDate, toTitleCase, nombreDesdeEmail, formatDiasCredito } from "@/lib/formatters";
import type { ProformaConFactura, ProformaRow } from "@/hooks/embarque";
import { sortByString, sortByNumber, sortByDate } from "@/components/shared/dataTable/sortingFns";

interface BuildArgs {
  descargar: (p: ProformaConFactura) => void;
  downloadingId: string | null;
  onMarcarFacturada: (p: ProformaRow) => void;
}

export function buildProformasColumns({
  descargar,
  downloadingId,
  onMarcarFacturada,
}: BuildArgs): ColumnDef<ProformaConFactura, unknown>[] {
  return defineColumns<ProformaConFactura>([
    {
      id: "numero",
      header: "# Proforma",
      accessorFn: (p) => p.numero,
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.numero),
      meta: { width: "w-[140px]", className: "font-medium whitespace-nowrap", sticky: true },
      cell: ({ row }) => row.original.numero,
    },
    {
      id: "expediente",
      header: "Expediente",
      accessorFn: (p) => p.expediente,
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.expediente),
      meta: { width: "w-[120px]", className: "whitespace-nowrap" },
      cell: ({ row }) => row.original.expediente,
    },
    {
      id: "bl_master",
      header: "BL Master",
      accessorFn: (p) => p.bl_master ?? "",
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.bl_master),
      meta: { width: "w-[140px]", className: "text-xs font-mono whitespace-nowrap" },
      cell: ({ row }) => row.original.bl_master || <span className="text-muted-foreground">—</span>,
    },
    {
      id: "tipo",
      header: "Tipo",
      accessorFn: (p) => (p.es_consolidada ? `Consolidada-${p.proformas_origen?.length ?? 0}` : "Individual"),
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) =>
        p.es_consolidada ? `Consolidada-${p.proformas_origen?.length ?? 0}` : "Individual",
      ),
      meta: { width: "w-[140px]" },
      cell: ({ row }) => {
        const p = row.original;
        if (p.es_consolidada) {
          const n = p.proformas_origen?.length ?? 0;
          return <Badge variant="info" className="whitespace-nowrap">Consolidada{n > 0 ? ` (${n})` : ""}</Badge>;
        }
        return <Badge variant="neutral" className="whitespace-nowrap">Individual</Badge>;
      },
    },
    {
      id: "cliente",
      header: "Cliente",
      accessorFn: (p) => p.cliente_nombre,
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.cliente_nombre),
      meta: { width: "min-w-[180px]", className: "max-w-[220px] truncate" },
      cell: ({ row }) => <span title={toTitleCase(row.original.cliente_nombre)}>{toTitleCase(row.original.cliente_nombre)}</span>,
    },
    {
      id: "operador",
      header: "Operador",
      accessorFn: (p) => p.operador ?? "",
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.operador),
      meta: { width: "w-[140px]", className: "text-xs whitespace-nowrap" },
      cell: ({ row }) => row.original.operador ? nombreDesdeEmail(row.original.operador) : <span className="text-muted-foreground">—</span>,
    },
    {
      id: "dias_credito",
      header: "Días Crédito",
      accessorFn: (p) => p.dias_credito ?? -1,
      enableSorting: true,
      sortingFn: sortByNumber<ProformaConFactura>((p) => p.dias_credito),
      meta: { width: "w-[110px]", className: "text-right text-xs whitespace-nowrap" },
      cell: ({ row }) => formatDiasCredito(row.original.dias_credito),
    },
    {
      id: "monto_usd",
      header: "Monto USD",
      accessorFn: (p) => Number(p.total_usd),
      enableSorting: true,
      sortingFn: sortByNumber<ProformaConFactura>((p) => Number(p.total_usd)),
      meta: { width: "w-[130px]", className: "text-right whitespace-nowrap" },
      cell: ({ row }) => Number(row.original.total_usd) > 0 ? formatCurrency(Number(row.original.total_usd), "USD") : "—",
    },
    {
      id: "monto_mxn",
      header: "Monto MXN",
      accessorFn: (p) => Number(p.total_mxn),
      enableSorting: true,
      sortingFn: sortByNumber<ProformaConFactura>((p) => Number(p.total_mxn)),
      meta: { width: "w-[140px]", className: "text-right whitespace-nowrap" },
      cell: ({ row }) => Number(row.original.total_mxn) > 0 ? formatCurrency(Number(row.original.total_mxn), "MXN") : "—",
    },
    {
      id: "fecha",
      header: "Fecha",
      accessorFn: (p) => p.fecha_emision,
      enableSorting: true,
      sortingFn: sortByDate<ProformaConFactura>((p) => p.fecha_emision),
      meta: { width: "w-[100px]", className: "text-xs" },
      cell: ({ row }) => formatDate(row.original.fecha_emision),
    },
    {
      id: "estado",
      header: "Estado",
      accessorFn: (p) => p.estado_proforma ?? "pendiente",
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.estado_proforma ?? "pendiente"),
      meta: { width: "w-[110px]" },
      cell: ({ row }) => {
        const estado = row.original.estado_proforma ?? "pendiente";
        return estado === "facturada"
          ? <Badge variant="success">Facturada</Badge>
          : <Badge variant="warning">Pendiente</Badge>;
      },
    },
    {
      id: "folio_factura",
      header: "Folio Factura",
      accessorFn: (p) => p.folio_factura_externa ?? "",
      enableSorting: true,
      sortingFn: sortByString<ProformaConFactura>((p) => p.folio_factura_externa),
      meta: { width: "w-[180px]", className: "text-xs" },
      cell: ({ row }) => {
        const p = row.original;
        if (!p.folio_factura_externa) return <span className="text-muted-foreground">—</span>;
        const pdfUrl = p.facturas?.factura_pdf_url;
        const xmlUrl = p.facturas?.factura_xml_url;
        return (
          <div className="flex items-center gap-1">
            <span className="font-mono">{p.folio_factura_externa}</span>
            {pdfUrl && <FacturaDownloadButton stored={pdfUrl} kind="pdf" size="sm" />}
            {xmlUrl && <FacturaDownloadButton stored={xmlUrl} kind="xml" size="sm" />}
          </div>
        );
      },
    },
    {
      id: "acciones",
      header: "Acciones",
      meta: { width: "w-[200px]" },
      cell: ({ row }) => {
        const p = row.original;
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
  ]);
}
