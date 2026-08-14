/**
 * Desglose comparable de importes en el modal "Aplicar anticipo a esta factura":
 * a la izquierda la factura (subtotal → saldo por pagar), a la derecha el anticipo
 * y el saldo estimado después de aplicar.
 */
import { formatCurrency } from "@/lib/formatters";
import { calcularSaldoDespuesDeAplicar } from "@/features/anticipos-proveedor/domain/saldoDespuesDeAplicar";
import type { AnticipoProveedorRow } from "@/features/anticipos-proveedor/hooks/useAnticiposProveedor";

export interface ImportesFactura {
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  total: number;
  pagado: number;
  notasCredito: number;
  saldo: number;
  moneda: string;
}

interface Props {
  factura: ImportesFactura;
  anticipo: AnticipoProveedorRow | null;
  montoAplicar: number;
}

function Renglon(
  { label, valor, moneda, destacado, negativo }:
  { label: string; valor: number; moneda: string; destacado?: boolean; negativo?: boolean },
) {
  return (
    <div
      className={
        destacado
          ? "flex items-baseline justify-between gap-3 border-t border-border pt-2 mt-1 text-sm font-semibold text-foreground"
          : "flex items-baseline justify-between gap-3 text-sm text-muted-foreground"
      }
    >
      <span>{label}</span>
      <span className={destacado ? "tabular-nums" : "tabular-nums text-foreground"}>
        {negativo && valor > 0 ? "−" : ""}
        {formatCurrency(Math.abs(valor), moneda)}
      </span>
    </div>
  );
}

export function AplicarAnticipoResumen({ factura, anticipo, montoAplicar }: Props) {
  const m = factura.moneda;
  const res = calcularSaldoDespuesDeAplicar({
    saldoFactura: factura.saldo,
    montoAplicar,
    monedaFactura: m,
    monedaAnticipo: anticipo?.moneda ?? m,
  });

  return (
    <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
      <section className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Esta factura
        </h4>
        <Renglon label="Subtotal" valor={factura.subtotal} moneda={m} />
        <Renglon label="IVA" valor={factura.iva} moneda={m} />
        {factura.ieps > 0 && <Renglon label="IEPS" valor={factura.ieps} moneda={m} />}
        {factura.retenciones > 0 && (
          <Renglon label="Retenciones" valor={factura.retenciones} moneda={m} negativo />
        )}
        <Renglon label="Total de la factura" valor={factura.total} moneda={m} destacado />
        <Renglon label="Ya pagado" valor={factura.pagado} moneda={m} negativo />
        {factura.notasCredito > 0 && (
          <Renglon label="Notas de crédito" valor={factura.notasCredito} moneda={m} negativo />
        )}
        <Renglon label="Saldo por pagar" valor={factura.saldo} moneda={m} destacado />
        <p className="text-xs text-muted-foreground">
          El saldo por pagar ya incluye IVA y está neto de retenciones, pagos y notas de crédito.
        </p>
      </section>

      <section className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Anticipo seleccionado
        </h4>
        {anticipo ? (
          <>
            <Renglon label="Monto del anticipo" valor={Number(anticipo.monto)} moneda={anticipo.moneda} />
            <Renglon label="Ya aplicado a otras facturas" valor={anticipo.aplicado} moneda={anticipo.moneda} negativo />
            <Renglon label="Disponible" valor={anticipo.disponible} moneda={anticipo.moneda} destacado />
            <Renglon label="Se va a aplicar" valor={montoAplicar > 0 ? montoAplicar : 0} moneda={anticipo.moneda} />
            <Renglon
              label={res.estimado ? "Saldo estimado después" : "Saldo después de aplicar"}
              valor={res.saldoRestante}
              moneda={m}
              destacado
            />
            {res.estimado && (
              <p className="text-xs text-muted-foreground">
                El anticipo está en {anticipo.moneda} y la factura en {m}: el saldo mostrado es
                referencial, el servidor convierte al tipo de cambio oficial al aplicar.
              </p>
            )}
            {!res.estimado && res.excedente > 0 && (
              <p className="text-xs text-warning">
                El monto excede el saldo por pagar en {formatCurrency(res.excedente, m)}.
              </p>
            )}
            {!res.estimado && res.excedente === 0 && res.quedaCubierta && montoAplicar > 0 && (
              <p className="text-xs text-muted-foreground">La factura queda totalmente cubierta.</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Selecciona un anticipo para ver el desglose.</p>
        )}
      </section>
    </div>
  );
}
