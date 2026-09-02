import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ListSkeleton } from "@/components/shared/states/ListSkeleton";
import { Badge } from "@/components/ui/badge";
import {
  usePortalPagosFactura,
  usePortalNotasCreditoFactura,
  usePortalResumenSaldoFactura,
} from "@/features/portal/hooks";
import { PORTAL_RELATED_MAX } from "@/features/portal/services/limits";
import { CheckCircle2, Clock, Receipt } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PortalFacturaPagosLista, type PortalPagoFila } from "./PortalFacturaPagosLista";
import {
  PortalFacturaNotasCreditoLista,
  type PortalNotaCreditoFila,
} from "./PortalFacturaNotasCreditoLista";
import { PortalFacturaTotales } from "./PortalFacturaTotales";

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
  const cargando = isLoading || loadingNc || loadingResumen;

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
        {cargando && <ListSkeleton rows={2} />}
        {!cargando && pagos.length === 0 && (
          <EmptyStateInline
            icon={Receipt}
            message="Aún no se han registrado pagos para esta factura."
          />
        )}
        {!cargando && pagos.length > 0 && (
          // SAFE-CAST: la consulta del portal ya devuelve estas columnas; el
          // tipo generado no incluye las URL del REP como opcionales.
          <PortalFacturaPagosLista
            pagos={pagos as unknown as PortalPagoFila[]}
            moneda={moneda}
          />
        )}

        {notasCredito.length > 0 && (
          <PortalFacturaNotasCreditoLista
            notasCredito={notasCredito as unknown as PortalNotaCreditoFila[]}
            moneda={moneda}
          />
        )}

        {listaTruncada && (
          <Alert>
            <AlertDescription>
              Se muestran los {PORTAL_RELATED_MAX} movimientos más recientes. Los totales y el
              saldo de abajo sí consideran todos los movimientos de la factura.
            </AlertDescription>
          </Alert>
        )}

        <PortalFacturaTotales
          totalFactura={totalFactura}
          totalPagado={totalPagado}
          totalNc={totalNc}
          saldo={saldo}
          liquidada={liquidada}
          moneda={moneda}
        />
      </CardContent>
    </Card>
  );
}
