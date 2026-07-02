/**
 * Sub-componentes presentacionales de `ProformaDetalle`.
 * Extraídos para mantener la página ≤200 líneas (Power-of-10 #4) y reducir
 * la complejidad ciclomática del componente página.
 */
import { Link } from "react-router-dom";
import { ExternalLink, Globe, UserCheck, Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatDate, formatDiasCredito, nombreDesdeEmail } from "@/lib/formatters";
import { getEstadoColor } from "@/lib/ui/uiMappings";
import { FacturaDownloadButton } from "@/features/facturacion/components/FacturaDownloadButton";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";
import type { ProformaDetalleFull } from "@/features/proformas/services";

export { AccionesProforma } from "./AccionesProforma";

type Totales = ReturnType<typeof calcularTotalesProforma>;
type FacturaAsociada = NonNullable<ProformaDetalleFull["facturas_full"]>;
type EstadoCliente = "pendiente" | "aceptada" | "rechazada";
type OrigenAceptacion = "portal" | "manual" | "migracion" | "desconocido";

/**
 * Deriva el origen de la aceptación a partir del campo `aceptada_por` que
 * escriben las RPCs (`manual:<email>`, `cliente_portal_token`, o el string
 * histórico de la migración de julio 2026).
 */
function derivarOrigenAceptacion(aceptadaPor: string | null | undefined): OrigenAceptacion {
  if (!aceptadaPor) return "desconocido";
  if (aceptadaPor === "cliente_portal_token") return "portal";
  if (aceptadaPor.startsWith("manual:")) return "manual";
  if (aceptadaPor.toLowerCase().includes("migración") || aceptadaPor.toLowerCase().includes("migracion")) return "migracion";
  return "desconocido";
}

function BadgeOrigenAceptacion({ origen }: { origen: OrigenAceptacion }) {
  const config = {
    portal: { icon: Globe, label: "Cliente aceptó por portal", tip: "El cliente aceptó la proforma desde el enlace del portal público." },
    manual: { icon: UserCheck, label: "Aceptación manual", tip: "Un miembro del equipo marcó la aceptación en nombre del cliente (llamada, WhatsApp, email fuera del sistema)." },
    migracion: { icon: Archive, label: "Aceptación histórica", tip: "Aceptación registrada durante la migración de datos anteriores a julio 2026." },
    desconocido: { icon: UserCheck, label: "Aceptada", tip: "Origen de la aceptación no registrado." },
  }[origen];
  const Icon = config.icon;
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="gap-1">
            <Icon className="h-3 w-3" />
            {config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">{config.tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function BadgeCiclo({
  estadoProforma,
  estadoCliente,
}: {
  estadoProforma: string | null | undefined;
  estadoCliente: EstadoCliente;
}) {
  if (estadoProforma === "facturada") {
    return <Badge variant="success">Facturada</Badge>;
  }
  if (estadoCliente === "rechazada") {
    return <Badge variant="destructive">Rechazada por cliente</Badge>;
  }
  if (estadoCliente === "aceptada") {
    return <Badge variant="info">Aceptada</Badge>;
  }
  return <Badge variant="warning">Pendiente cliente</Badge>;
}

export function EstadoBadges({
  estadoProforma,
  estadoCliente,
  aceptadaPor,
}: {
  estadoProforma?: string | null;
  estadoCliente?: EstadoCliente;
  /** Valor crudo de `proformas.aceptada_por`, se usa para derivar el origen. */
  aceptadaPor?: string | null;
}) {
  const ec = estadoCliente ?? "pendiente";
  const mostrarOrigen = ec === "aceptada";
  const origen = derivarOrigenAceptacion(aceptadaPor);
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <BadgeCiclo estadoProforma={estadoProforma} estadoCliente={ec} />
      {mostrarOrigen && <BadgeOrigenAceptacion origen={origen} />}
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
