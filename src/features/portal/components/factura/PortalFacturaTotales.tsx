import { formatCurrency } from "@/lib/formatters";

/**
 * Bloque de totales (facturado, pagos, notas de crédito, saldo) de una factura
 * en el portal. Los importes vienen del agregado completo en base de datos, no
 * de las listas topadas. Extraído de `PortalFacturaPagosCard`.
 */
interface Props {
  totalFactura: number;
  totalPagado: number;
  totalNc: number;
  saldo: number;
  liquidada: boolean;
  moneda: string;
}

export function PortalFacturaTotales({
  totalFactura,
  totalPagado,
  totalNc,
  saldo,
  liquidada,
  moneda,
}: Props) {
  return (
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
        <dd
          className={`font-bold tabular-nums ${liquidada ? "text-success" : "text-accent"}`}
        >
          {formatCurrency(saldo, moneda)}
        </dd>
      </div>
    </dl>
  );
}
