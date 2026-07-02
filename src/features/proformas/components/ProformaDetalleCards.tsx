/**
 * Sub-componentes presentacionales de `ProformaDetalle`.
 * Extraídos para mantener la página ≤200 líneas (Power-of-10 #4) y reducir
 * la complejidad ciclomática del componente página.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Ship, Loader2, ExternalLink, FileText, Mail, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate, formatDiasCredito, nombreDesdeEmail } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import { ConvertirAFacturaDialog } from "@/features/proformas/components/ConvertirAFacturaDialog";
import { EnviarProformaDialog } from "@/features/proformas/components/EnviarProformaDialog";
import { RespuestaClienteManualDialog } from "@/features/proformas/components/RespuestaClienteManualDialog";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import type { ProformaDetalleFull } from "@/features/proformas/services";

type Totales = ReturnType<typeof calcularTotalesProforma>;
type FacturaAsociada = NonNullable<ProformaDetalleFull["facturas_full"]>;
type EstadoCliente = "pendiente" | "aceptada" | "rechazada";

function readEstadoCliente(p: ProformaDetalleFull): EstadoCliente {
  // SAFE-CAST: columna nueva; los tipos generados aún no la incluyen.
  const raw = (p as unknown as { estado_cliente?: string }).estado_cliente;
  if (raw === "aceptada" || raw === "rechazada") return raw;
  return "pendiente";
}

export function EstadoBadges({
  estadoRev,
  facturada,
  estadoCliente,
}: {
  estadoRev: string;
  facturada: boolean;
  estadoCliente?: EstadoCliente;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {estadoRev === "pendiente" && <Badge variant="warning">Pendiente de revisión</Badge>}
      {estadoRev === "aprobada" && <Badge variant="success">Aprobada</Badge>}
      {estadoRev === "consolidada" && <Badge variant="info">Consolidada</Badge>}
      {estadoCliente === "aceptada" && <Badge variant="success">Cliente aceptó</Badge>}
      {estadoCliente === "rechazada" && <Badge variant="destructive">Cliente rechazó</Badge>}
      {estadoCliente === "pendiente" && <Badge variant="outline">Cliente sin responder</Badge>}
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
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState<null | "aceptada" | "rechazada">(null);

  const facturada = (proforma.estado_proforma ?? "pendiente") === "facturada";
  const aprobada = (proforma.estado_revision ?? "") === "aprobada";
  const estadoCliente = readEstadoCliente(proforma);
  const clienteAcepto = estadoCliente === "aceptada";
  const puedeConvertir = aprobada && clienteAcepto && !facturada && !proforma.factura_id;
  const puedeResponder = !facturada && estadoCliente === "pendiente";

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" disabled={cargando} onClick={onDescargar}>
        {cargando
          ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          : <Download className="h-4 w-4 mr-1.5" />}
        Descargar PDF
      </Button>

      {!facturada && (
        <Button variant="outline" size="sm" onClick={() => setEnviarOpen(true)}>
          <Mail className="h-4 w-4 mr-1.5" /> Enviar al cliente
        </Button>
      )}

      {puedeResponder && (
        <>
          <Button variant="outline" size="sm" onClick={() => setManualOpen("aceptada")}>
            <CheckCircle2 className="h-4 w-4 mr-1.5 text-emerald-600" /> Aceptar (manual)
          </Button>
          <Button variant="outline" size="sm" onClick={() => setManualOpen("rechazada")}>
            <XCircle className="h-4 w-4 mr-1.5 text-red-600" /> Rechazar (manual)
          </Button>
        </>
      )}

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

      {aprobada && !clienteAcepto && !facturada && (
        <span className="text-xs text-muted-foreground self-center ml-1">
          Para facturar, el cliente debe aceptar la proforma.
        </span>
      )}

      <EnviarProformaDialog open={enviarOpen} onOpenChange={setEnviarOpen} proforma={proforma} />

      {manualOpen && (
        <RespuestaClienteManualDialog
          open={!!manualOpen}
          onOpenChange={(o) => { if (!o) setManualOpen(null); }}
          proformaId={proforma.id}
          numero={proforma.numero ?? ""}
          modo={manualOpen}
        />
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
  const timbrada = !!factura.uuid_fiscal;
  const tieneArchivos = !!(factura.factura_pdf_url || factura.factura_xml_url || timbrada);
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
            <FacturaDownloadButton stored={factura.factura_pdf_url ?? null} kind="pdf" size="sm" facturaId={factura.id} />
            <FacturaDownloadButton stored={factura.factura_xml_url ?? null} kind="xml" size="sm" facturaId={factura.id} />
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
