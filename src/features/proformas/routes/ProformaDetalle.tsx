/**
 * ProformaDetalle — página dedicada de una proforma individual.
 * Drilldown desde el tab Facturación del embarque y del módulo Pre-facturación.
 */
import { useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, Download, Ship, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, defineColumns, type ColumnDef } from "@/components/shared/DataTable";
import { formatCurrency, formatDate, formatDiasCredito, nombreDesdeEmail } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { useProformaDetalle } from "@/features/proformas/hooks/useProformaDetalle";
import { useDescargarProformaPdf } from "@/features/embarques/hooks/useDescargarProformaPdf";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";
import { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { EstadoBadges, TotalesCard } from "@/features/proformas/components/ProformaDetalleCards";
import type { ConceptoVentaRow } from "@/features/proformas/services";



export default function ProformaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useProformaDetalle(id);
  const { descargar, downloadingId } = useDescargarProformaPdf();
  const tasaIva = useTasaIVA();
  useRegisterBreadcrumbLabel(id, data?.proforma.numero);

  const totales = useMemo(() => {
    if (!data) return null;
    return calcularTotalesProforma(data.conceptos, tasaIva);
  }, [data, tasaIva]);

  const conceptoColumns: ColumnDef<ConceptoVentaRow, unknown>[] = defineColumns<ConceptoVentaRow>([
    { id: "descripcion", header: "Descripción", cell: ({ row }) => row.original.descripcion },
    {
      id: "cantidad",
      header: "Cant.",
      meta: { align: "right", className: "w-[80px] tabular-nums" },
      cell: ({ row }) => Number(row.original.cantidad),
    },
    {
      id: "precio",
      header: "Precio unitario",
      meta: { align: "right", className: "w-[140px] tabular-nums" },
      cell: ({ row }) => formatCurrency(Number(row.original.precio_unitario), row.original.moneda),
    },
    {
      id: "importe",
      header: "Importe",
      meta: { align: "right", className: "w-[140px] tabular-nums font-medium" },
      cell: ({ row }) => formatCurrency(
        Number(row.original.cantidad) * Number(row.original.precio_unitario),
        row.original.moneda,
      ),
    },
    {
      id: "iva",
      header: "IVA",
      meta: { align: "center", className: "w-[80px] text-xs" },
      cell: ({ row }) => row.original.aplica_iva || row.original.moneda === "MXN" ? "Sí" : "No",
    },
  ]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Proforma no encontrada o sin acceso.</p>
        <Button variant="link" onClick={() => navigate(-1)}>Volver</Button>
      </div>
    );
  }

  const { proforma, conceptos } = data;
  const facturada = (proforma.estado_proforma ?? "pendiente") === "facturada";
  const estadoRev = proforma.estado_revision ?? "aprobada";
  const factura = proforma.facturas_full;

  return (
    <div className="space-y-5 p-4 md:p-6 max-w-6xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-mono tabular-nums">{proforma.numero}</h1>
            <EstadoBadges estadoRev={estadoRev} facturada={facturada} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {proforma.cliente_nombre} • Exp: <span className="font-mono">{proforma.expediente}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            variant="outline" size="sm"
            disabled={downloadingId === proforma.id}
            onClick={() => descargar(proforma)}
          >
            {downloadingId === proforma.id
              ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              : <Download className="h-4 w-4 mr-1.5" />}
            Descargar PDF
          </Button>
          {proforma.embarque_id && (
            <Button variant="outline" size="sm" asChild>
              <Link to={`/embarques/${proforma.embarque_id}?tab=facturacion`}>
                <Ship className="h-4 w-4 mr-1.5" /> Ver embarque
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Datos generales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><p className="text-xs text-muted-foreground">Fecha emisión</p><p>{formatDate(proforma.fecha_emision)}</p></div>
          <div><p className="text-xs text-muted-foreground">Operador</p><p>{proforma.operador || "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Días crédito</p><p>{formatDiasCredito(proforma.dias_credito)}</p></div>
          <div><p className="text-xs text-muted-foreground">Folio factura</p><p className="font-mono">{proforma.folio_factura_externa || "—"}</p></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conceptos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <DataTable
            columns={conceptoColumns}
            data={conceptos}
            rowKey={(c) => c.id}
            density="compact"
            emptyMessage={proforma.es_consolidada ? "Proforma consolidada (ver detalle agregado en el PDF)." : "Sin conceptos."}
          />
        </CardContent>
      </Card>

      {totales && <TotalesCard totales={totales} />}


      {factura && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Factura asociada</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <div>
              <Link to={`/facturacion/${factura.id}`} className="font-mono font-medium text-accent hover:underline">
                {factura.numero}
              </Link>
              <p className="text-xs text-muted-foreground mt-0.5">
                {factura.estado} • {formatCurrency(Number(factura.total), factura.moneda)}
              </p>
            </div>
            <div className="flex gap-2">
              {factura.factura_pdf_url && (
                <FacturaDownloadButton stored={factura.factura_pdf_url} kind="pdf" size="sm" />
              )}
              {factura.factura_xml_url && (
                <FacturaDownloadButton stored={factura.factura_xml_url} kind="xml" size="sm" />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
