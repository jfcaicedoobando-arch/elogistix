import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { usePortalPagosFactura } from "@/features/portal/hooks";
import { FORMAS_PAGO_SAT, labelDeCatalogo } from "@/constants/catalogosSAT";
import { CheckCircle2, Clock, FileText, FileCode2 } from "lucide-react";

interface Props {
  facturaId: string;
  totalFactura: number;
  moneda: string;
}

export default function PortalFacturaPagosCard({ facturaId, totalFactura, moneda }: Props) {
  const { data: pagos = [], isLoading } = usePortalPagosFactura(facturaId);

  const totalPagado = pagos.reduce((acc, p) => acc + Number(p.monto_aplicado_factura ?? 0), 0);
  const saldo = Math.max(0, totalFactura - totalPagado);
  const liquidada = saldo < 0.01;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-lg">Historial de pagos</CardTitle>
        {pagos.length > 0 && (
          <Badge variant={liquidada ? "default" : "secondary"} className="gap-1">
            {liquidada ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
            {liquidada ? "Liquidada" : "Saldo pendiente"}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <ListSkeleton rows={2} />
        ) : pagos.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Aún no se han registrado pagos para esta factura.
          </p>
        ) : (
          <ul className="divide-y">
            {pagos.map((p) => {
              const pRep = p as typeof p & {
                rep_uuid?: string | null;
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

        <div className="border-t pt-3 grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Pagado</p>
            <p className="font-semibold tabular-nums">{formatCurrency(totalPagado, moneda)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Saldo</p>
            <p className={`font-bold tabular-nums ${liquidada ? "text-success" : "text-accent"}`}>
              {formatCurrency(saldo, moneda)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
