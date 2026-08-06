import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  usePortalPagosFactura,
  usePortalNotasCreditoFactura,
} from "@/features/portal/hooks";
import { calcularSaldoFacturaPortal } from "@/features/portal/services";
import { FORMAS_PAGO_SAT, labelDeCatalogo } from "@/constants/catalogosSAT";
import { CheckCircle2, Clock, FileText, FileCode2, Receipt } from "lucide-react";

interface Props {
  facturaId: string;
  totalFactura: number;
  moneda: string;
}

export default function PortalFacturaPagosCard({ facturaId, totalFactura, moneda }: Props) {
  const { data: pagos = [], isLoading } = usePortalPagosFactura(facturaId);
  const { data: notasCredito = [], isLoading: loadingNc } =
    usePortalNotasCreditoFactura(facturaId);

  // B-082: el saldo del portal descuenta pagos Y notas de crédito aplicadas.
  const resumen = calcularSaldoFacturaPortal(totalFactura, pagos, notasCredito);
  const { pagado: totalPagado, notasCredito: totalNc, saldo, liquidada } = resumen;
  const hayMovimientos = pagos.length > 0 || notasCredito.length > 0;

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
        {isLoading || loadingNc ? (
          <ListSkeleton rows={2} />
        ) : pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aún no se han registrado pagos para esta factura.
          </p>
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
                    <p className="text-sm font-medium">{formatDate(p.fecha_pago)}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {labelDeCatalogo(FORMAS_PAGO_SAT, p.forma_pago)}{p.referencia ? ` • ${p.referencia}` : ""}
                    </p>
                    {(pRep.rep_pdf_url || pRep.rep_xml_url) && (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        {pRep.rep_pdf_url && (
                          <Button asChild size="sm" variant="outline" className="h-6 px-2 text-2xs">
                            <a href={pRep.rep_pdf_url} target="_blank" rel="noopener noreferrer">
                              <FileText className="h-3 w-3 mr-1" /> REP PDF
                            </a>
                          </Button>
                        )}
                        {pRep.rep_xml_url && (
                          <Button asChild size="sm" variant="outline" className="h-6 px-2 text-2xs">
                            <a href={pRep.rep_xml_url} target="_blank" rel="noopener noreferrer">
                              <FileCode2 className="h-3 w-3 mr-1" /> REP XML
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums">
                      {formatCurrency(Number(p.monto_aplicado_factura), moneda)}
                    </p>
                    {p.moneda !== moneda && (
                      <p className="text-2xs text-muted-foreground">
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
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Receipt className="h-3.5 w-3.5" /> Notas de crédito aplicadas
            </p>
            <ul className="divide-y">
              {notasCredito.map((nc) => (
                <li key={nc.id} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">NC {nc.folio ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(nc.fecha_emision)}</p>
                  </div>
                  <p className="text-sm font-bold tabular-nums text-success shrink-0">
                    −{formatCurrency(Number(nc.monto), moneda)}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <dl className="border-t pt-3 space-y-1.5 text-sm">
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
