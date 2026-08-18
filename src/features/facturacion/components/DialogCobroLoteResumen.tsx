/**
 * Banda fija de totales del cobro en lote (recibido / repartido / sin asignar).
 * Vive en el `stickyBottom` del FormDialogShell para quedar siempre visible.
 */
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { FacturaCobroCandidata, RenglonCobro } from "@/features/facturacion/services/pagoClienteLote";

interface Props {
  facturas: FacturaCobroCandidata[];
  renglones: RenglonCobro[];
  moneda: string;
  /** Importe capturado que recibió el cliente. */
  recibido: number;
  totalRepartido: number;
  sinAsignar: number;
  error: string | null;
  /** Facturas PPD timbradas del reparto que generarán REP automáticamente. */
  repRequeridos?: number;
  /** Asigna el sobrante a la siguiente factura pendiente. */
  onAsignarSobrante?: () => void;
}

export function DialogCobroLoteResumen(p: Props) {
  const liquidadas = p.facturas.filter((f) => {
    const monto = p.renglones.find((r) => r.factura_id === f.factura_id)?.monto ?? 0;
    return monto > 0 && f.saldo - monto <= 0.005;
  }).length;
  const conMonto = p.renglones.filter((r) => r.monto > 0).length;
  const sobrante = p.sinAsignar > 0.005;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span className="text-muted-foreground">
          Recibido:{" "}
          <strong className="tabular-nums text-foreground">
            {formatCurrency(p.recibido, p.moneda)}
          </strong>
        </span>
        <span className="text-muted-foreground">
          Repartido:{" "}
          <strong className="tabular-nums text-foreground">
            {formatCurrency(p.totalRepartido, p.moneda)}
          </strong>
        </span>
        <span className={sobrante ? "text-warning" : "text-muted-foreground"}>
          Sin asignar:{" "}
          <strong className="tabular-nums">{formatCurrency(p.sinAsignar, p.moneda)}</strong>
        </span>
        <span className="text-muted-foreground">
          {liquidadas} de {conMonto || p.facturas.length} quedan liquidadas
        </span>
        {sobrante && p.onAsignarSobrante && (
          <Button type="button" variant="outline" size="sm" onClick={p.onAsignarSobrante}>
            Asignar sobrante
          </Button>
        )}
      </div>
      {sobrante && (
        <p className="text-xs text-warning">
          Faltan {formatCurrency(p.sinAsignar, p.moneda)} por repartir: usa “Asignar sobrante” o
          ajusta los importes por factura.
        </p>
      )}
      {!!p.repRequeridos && p.repRequeridos > 0 && (
        <p className="text-xs text-muted-foreground">
          {p.repRequeridos === 1
            ? "1 factura requiere complemento de pago (REP): se timbrará automáticamente al aplicar el cobro."
            : `${p.repRequeridos} facturas requieren complemento de pago (REP): se timbrarán automáticamente al aplicar el cobro.`}
        </p>
      )}
      {p.error && <p className="text-xs text-destructive">{p.error}</p>}
    </div>
  );
}
