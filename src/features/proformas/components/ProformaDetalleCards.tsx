/**
 * Sub-componentes presentacionales de `ProformaDetalle`.
 * Extraídos para mantener la página ≤200 líneas (Power-of-10 #4) y reducir
 * la complejidad ciclomática del componente página.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Ship, Loader2, ExternalLink, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatDiasCredito, nombreDesdeEmail } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { ConvertirAFacturaDialog } from "@/features/proformas/components/ConvertirAFacturaDialog";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import type { ProformaDetalleFull } from "@/features/proformas/services";

type Totales = ReturnType<typeof calcularTotalesProforma>;
type FacturaAsociada = NonNullable<ProformaDetalleFull["facturas_full"]>;

export function EstadoBadges({ estadoRev, facturada }: { estadoRev: string; facturada: boolean }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {estadoRev === "pendiente" && <Badge variant="warning">Pendiente de revisión</Badge>}
      {estadoRev === "aprobada" && <Badge variant="success">Aprobada</Badge>}
      {estadoRev === "consolidada" && <Badge variant="info">Consolidada</Badge>}
      {facturada
        ? <Badge variant="success">Facturada</Badge>
        : <Badge variant="warning">Pago pendiente</Badge>}
    </div>
  );
}

export function TotalDestacado({ totales }: { totales: Totales }) {
  const esUsd = totales.subtotal_usd > 0;
  const total = esUsd ? totales.total_usd : totales.total_mxn;
  return (
    <div className="text-right shrink-0">
      <p className="text-xs text-muted-foreground">Total</p>
      <p className="text-2xl font-bold tabular-nums text-accent">
        {formatCurrency(total, esUsd ? "USD" : "MXN")}
      </p>
    </div>
  );
}

interface AccionesProps {
  proforma: ProformaDetalleFull;
  downloadingId: string | null;
  onDescargar: () => void;
}

export function AccionesProforma({ proforma, downloadingId, onDescargar }: AccionesProps) {
  const cargando = downloadingId === proforma.id;
  const [convertirOpen, setConvertirOpen] = useState(false);
  const facturada = (proforma.estado_proforma ?? "pendiente") === "facturada";
  const aprobada = (proforma.estado_revision ?? "") === "aprobada";
  const puedeConvertir = aprobada && !facturada && !proforma.factura_id;
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={cargando} onClick={onDescargar}>
        {cargando
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
      {puedeConvertir && (
        <>
          <Button size="sm" onClick={() => setConvertirOpen(true)}>
            <FileText className="h-4 w-4 mr-1.5" /> Convertir a factura
          </Button>
          <ConvertirAFacturaDialog
            open={convertirOpen}
            onOpenChange={setConvertirOpen}
            proformaIds={[proforma.id]}
            organizationId={proforma.organization_id}
            diasCreditoDefault={proforma.dias_credito ?? 0}
          />
        </>
      )}
    </div>
  );
}


export function DatosGeneralesCard({ proforma }: { proforma: ProformaDetalleFull }) {
  return (
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
  );
}

export function FacturaAsociadaCard({ factura }: { factura: FacturaAsociada }) {
  const tieneArchivos = !!(factura.factura_pdf_url || factura.factura_xml_url);
  return (
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
        {tieneArchivos && (
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
  );
}

export function TotalesCard({ totales }: { totales: Totales }) {
  const hasUsd = totales.subtotal_usd > 0;
  const hasMxn = totales.subtotal_mxn > 0;
  if (!hasUsd && !hasMxn) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Totales</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-6 text-sm">
        {hasUsd && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">USD</p>
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totales.subtotal_usd, "USD")}</span></div>
            <div className="flex justify-between"><span>IVA</span><span className="tabular-nums">{formatCurrency(totales.iva_usd, "USD")}</span></div>
            <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span className="tabular-nums text-accent">{formatCurrency(totales.total_usd, "USD")}</span></div>
          </div>
        )}
        {hasMxn && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">MXN</p>
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totales.subtotal_mxn, "MXN")}</span></div>
            <div className="flex justify-between"><span>IVA</span><span className="tabular-nums">{formatCurrency(totales.iva_mxn, "MXN")}</span></div>
            <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span className="tabular-nums text-accent">{formatCurrency(totales.total_mxn, "MXN")}</span></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
