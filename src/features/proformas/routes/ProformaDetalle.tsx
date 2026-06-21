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
    <div className="space-y-4 p-4 md:p-6 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      {/* Header con total destacado */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold font-mono tabular-nums">{proforma.numero}</h1>
            <EstadoBadges estadoRev={estadoRev} facturada={facturada} />
          </div>
          <p className="text-sm text-muted-foreground mt-1 truncate" title={proforma.cliente_nombre ?? ''}>
            {proforma.cliente_nombre} • Exp: <span className="font-mono">{proforma.expediente}</span>
          </p>
        </div>
        {totales && (
          <div className="text-right shrink-0">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-2xl font-bold tabular-nums text-accent">
              {formatCurrency(
                totales.subtotal_usd > 0 ? totales.total_usd : totales.total_mxn,
                totales.subtotal_usd > 0 ? "USD" : "MXN",
              )}
            </p>
          </div>
        )}
      </div>

      {/* Acciones secundarias */}
      <div className="flex flex-wrap gap-2">
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

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Datos generales</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Fecha emisión</p>
            <p>{formatDate(proforma.fecha_emision)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Operador</p>
            <p className="truncate" title={proforma.operador ?? ''}>
              {proforma.operador ? nombreDesdeEmail(proforma.operador) : '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Días crédito</p>
            <p>{formatDiasCredito(proforma.dias_credito)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Folio factura</p>
            <p className="font-mono truncate" title={proforma.folio_factura_externa ?? ''}>
              {proforma.folio_factura_externa || "—"}
            </p>
          </div>
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
          <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-sm flex items-center gap-2">
              Factura asociada
              <span className="font-mono">{factura.numero}</span>
              <Badge className={`${getEstadoColor(factura.estado)} text-xs`}>{factura.estado}</Badge>
            </CardTitle>
            <Button size="sm" asChild>
              <Link to={`/facturacion/${factura.id}`}>
                <ExternalLink className="h-4 w-4 mr-1.5" /> Ver factura
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Monto</p>
              <p className="tabular-nums font-medium">{formatCurrency(Number(factura.total), factura.moneda)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fecha emisión</p>
              <p>{factura.fecha_emision ? formatDate(factura.fecha_emision) : '—'}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">UUID fiscal</p>
              <p className="font-mono text-xs truncate" title={factura.uuid_fiscal ?? ''}>
                {factura.uuid_fiscal || '—'}
              </p>
            </div>
            {(factura.factura_pdf_url || factura.factura_xml_url) && (
              <div className="col-span-2 md:col-span-3 flex flex-wrap gap-2 pt-1 border-t">
                {factura.factura_pdf_url && (
                  <FacturaDownloadButton stored={factura.factura_pdf_url} kind="pdf" size="sm" />
                )}
                {factura.factura_xml_url && (
                  <FacturaDownloadButton stored={factura.factura_xml_url} kind="xml" size="sm" />
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
