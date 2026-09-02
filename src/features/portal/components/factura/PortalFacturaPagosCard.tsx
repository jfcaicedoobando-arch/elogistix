import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  usePortalPagosFactura,
  usePortalNotasCreditoFactura,
  usePortalResumenSaldoFactura,
} from "@/features/portal/hooks";
import { PORTAL_RELATED_MAX } from "@/features/portal/services/limits";
import { FORMAS_PAGO_SAT, labelDeCatalogo } from "@/constants/catalogosSAT";
import { CheckCircle2, Clock, Receipt } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PortalRepDownloadButtons } from "./PortalRepDownloadButtons";

interface Props {
  facturaId: string;
  totalFactura: number;
  moneda: string;
  /** Estado de la factura: si es terminal (Pagada/Cancelada) el saldo es 0. */
  estadoFactura?: string | null;
}

export default function PortalFacturaPagosCard({
  facturaId,
  totalFactura,
  moneda,
  estadoFactura,
}: Props) {
  const { data: pagos = [], isLoading } = usePortalPagosFactura(facturaId);
  const { data: notasCredito = [], isLoading: loadingNc } =
    usePortalNotasCreditoFactura(facturaId);
  // Defecto 7: los KPI (pagos, NC, saldo) vienen del agregado completo en BD.
  const { data: resumen, isLoading: loadingResumen } =
    usePortalResumenSaldoFactura(facturaId);

  const terminal = estadoFactura === "Pagada" || estadoFactura === "Cancelada";
  const totalPagado = resumen?.pagado ?? 0;
  const totalNc = resumen?.notasCredito ?? 0;
  const saldo = terminal ? 0 : resumen?.saldo ?? 0;
  const liquidada = terminal || (resumen?.liquidada ?? false);
  const hayMovimientos = (resumen?.numPagos ?? 0) > 0 || (resumen?.numNotas ?? 0) > 0;
  // Las listas sí están topadas: se avisa cuando hay más movimientos que los
  // mostrados, para que el cliente no crea que el detalle está completo.
  const listaTruncada =
    pagos.length >= PORTAL_RELATED_MAX || notasCredito.length >= PORTAL_RELATED_MAX;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Pagos y notas de crédito</CardTitle>
        {hayMovimientos && (
          <Badge variant={liquidada ? "default" : "secondary"} className="gap-1">
            {liquidada ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {liquidada ? "Liquidada" : "Saldo pendiente"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading || loadingNc || loadingResumen ? (
          <ListSkeleton rows={2} />
        ) : pagos.length === 0 ? (
          <EmptyStateInline
            icon={Receipt}
            message="Aún no se han registrado pagos para esta factura."
          />
        ) : (
          <ul className="divide-y">
            {pagos.map((p) => {
              const pRep = p as typeof p & {
                rep_pdf_url?: string | null;
                rep_xml_url?: string | null;
              };
              return (
                <li key={p.id} className="py-2 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-body font-medium">{formatDate(p.fecha_pago)}</p>
                    <p className="text-body-sm text-muted-foreground truncate">
                      {labelDeCatalogo(FORMAS_PAGO_SAT, p.forma_pago)}{p.referencia ? ` • ${p.referencia}` : ""}
                    </p>
                    <PortalRepDownloadButtons
                      pagoId={p.id}
                      tienePdf={!!pRep.rep_pdf_url}
                      tieneXml={!!pRep.rep_xml_url}
                    />
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-body font-bold tabular-nums">
                      {formatCurrency(Number(p.monto_aplicado_factura), moneda)}
                    </p>
                    {p.moneda !== moneda && (
                      <p className="text-label text-muted-foreground">
                        {formatCurrency(Number(p.monto), p.moneda)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {notasCredito.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <p className="text-body-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Notas de crédito aplicadas
            </p>
            <ul className="divide-y">
              {notasCredito.map((nc) => (
                <li key={nc.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body font-medium truncate">NC {nc.folio ?? "—"}</p>
                    <p className="text-body-sm text-muted-foreground">{formatDate(nc.fecha_emision)}</p>
                  </div>
                  <p className="text-body font-bold tabular-nums text-success shrink-0">
                    −{formatCurrency(Number(nc.monto), moneda)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        {listaTruncada && (
          <Alert>
            <AlertDescription>
              Se muestran los {PORTAL_RELATED_MAX} movimientos más recientes. Los totales y el
              saldo de abajo sí consideran todos los movimientos de la factura.
            </AlertDescription>
          </Alert>
        )}

        <dl className="border-t pt-3 space-y-1.5 text-body">
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Total facturado</dt>
            <dd className="tabular-nums">{formatCurrency(totalFactura, moneda)}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-muted-foreground">Pagos</dt>
            <dd className="tabular-nums">−{formatCurrency(totalPagado, moneda)}</dd>
          </div>
          {totalNc > 0 && (
            <div className="flex items-center justify-between">
              <dt className="text-muted-foreground">Notas de crédito</dt>
              <dd className="tabular-nums">−{formatCurrency(totalNc, moneda)}</dd>
            </div>
          )}
          <div className="flex items-center justify-between border-t pt-1.5">
            <dt className="font-medium">Saldo</dt>
            <dd className={`font-bold tabular-nums ${liquidada ? "text-success" : "text-accent"}`}>
              {formatCurrency(saldo, moneda)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
