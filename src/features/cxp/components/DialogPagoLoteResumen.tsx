/**
 * Banda fija de totales del pago en lote a proveedor (repartido / sin asignar /
 * liquidadas). Vive en el `stickyBottom` del FormDialogShell para quedar
 * siempre visible. Espejo de `DialogCobroLoteResumen` (CxC).
 */
import { formatCurrency } from "@/lib/formatters";
import type { FacturaLoteCandidata, RenglonLote } from "@/features/cxp/services/pagoProveedorLote";

interface Props {
  facturas: FacturaLoteCandidata[];
  renglones: RenglonLote[];
  moneda: string;
  totalRepartido: number;
  sinAsignar: number;
  error: string | null;
}

export function DialogPagoLoteResumen(p: Props) {
  const liquidadas = p.facturas.filter((f) => {
    const monto = p.renglones.find((r) => r.factura_id === f.factura_id)?.monto ?? 0;
    return monto > 0 && f.saldo - monto <= 0.009;
  }).length;
  const conMonto = p.renglones.filter((r) => r.monto > 0).length;
  const sobrante = p.sinAsignar > 0.009;

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
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
      </div>
      {p.error && <p className="text-xs text-destructive">{p.error}</p>}
    </div>
  );
}
