/**
 * Bloques del panel "Detalle del pago" (Tesorería).
 *
 * Se separan del Sheet para mantener cada archivo corto y enfocado:
 * datos del pago, movimiento bancario conciliado y facturas aplicadas.
 */
import { Link } from "react-router";
import { Landmark } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  TIPO_PAGO_DETALLE_LABELS, esDineroRecibido,
  type MovimientoConciliado, type PagoDetalleEncabezado,
} from "@/features/tesoreria/domain/pagoDetalle";
import { MovimientoAusente } from "@/features/tesoreria/components/DetallePagoSheet.movimiento";

/**
 * El banco guarda el importe en la moneda de la cuenta; sólo la conocemos con
 * certeza cuando el movimiento y el pago comparten cuenta bancaria.
 */
function monedaDelMovimiento(
  movimiento: MovimientoConciliado,
  cuentaBancariaPagoId: string | null,
  monedaCuentaPago: string | null,
): string {
  const mismaCuenta =
    !!movimiento.cuenta_bancaria_id && movimiento.cuenta_bancaria_id === cuentaBancariaPagoId;
  return mismaCuenta && monedaCuentaPago ? monedaCuentaPago : "MXN";
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-body">{children}</p>
    </div>
  );
}

/** Los ajustes muestran su importe sin presentarlo como entrada o salida. */
function presentacionPago(pago: PagoDetalleEncabezado) {
  if (pago.es_ajuste) return { tipo: "Ajuste no monetario", importe: "Importe ajustado", color: "text-foreground" };
  const esCobro = esDineroRecibido(pago.tipo);
  return { tipo: TIPO_PAGO_DETALLE_LABELS[pago.tipo], importe: esCobro ? "Dinero recibido" : "Dinero pagado",
    color: esCobro ? "text-success" : "text-destructive" };
}

export function BloquePago({ pago }: { pago: PagoDetalleEncabezado }) {
  const presentacion = presentacionPago(pago);
  const esCliente = ["cobro", "lote_cobro"].includes(pago.tipo);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{presentacion.tipo}</Badge>
        {pago.estado ? (
          pago.tipo === "anticipo"
            ? <StatusBadge domain="anticipo_proveedor" status={pago.estado} />
            : <Badge variant="outline">{pago.estado}</Badge>
        ) : null}
      </div>
      <div className="rounded-md border p-3">
        <p className="text-2xs uppercase tracking-wide text-muted-foreground">
          {presentacion.importe}
        </p>
        <p className={`text-kpi tabular-nums ${presentacion.color}`}>
          {formatCurrency(pago.monto, pago.moneda)}
        </p>
        {!pago.es_ajuste && pago.moneda !== "MXN" ? (
          // MNY-P2.3: sin T/C registrado no se muestra "TC 1.0000" ni un
          // equivalente en pesos inventado.
          pago.tipo_cambio && pago.monto_mxn != null ? (
            <p className="text-body-sm text-muted-foreground">
              Equivale a {formatCurrency(pago.monto_mxn, "MXN")} (TC {pago.tipo_cambio.toFixed(4)})
            </p>
          ) : (
            <p className="text-body-sm text-warning">
              Sin T/C registrado: no se puede calcular el equivalente en pesos.
            </p>
          )
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">

        <Dato label="Fecha">{formatDate(pago.fecha)}</Dato>
        <Dato label={esCliente ? "Cliente" : "Proveedor"}>{pago.contraparte ?? "—"}</Dato>
        <Dato label="Método">{pago.metodo_pago ?? "—"}</Dato>
        <Dato label="Referencia">{pago.referencia ?? "—"}</Dato>
        <Dato label="Cuenta bancaria">{pago.cuenta_alias ?? "—"}</Dato>
        {pago.saldo_disponible != null ? (
          <Dato label="Saldo del anticipo">
            {formatCurrency(pago.saldo_disponible, pago.moneda)}
          </Dato>
        ) : (
          <Dato label="Diferencia cambiaria">
            {formatCurrency(pago.diferencia_cambiaria_mxn, "MXN")}
          </Dato>
        )}
      </div>
      {pago.notas ? <Dato label="Notas">{pago.notas}</Dato> : null}
    </section>
  );
}

export function BloqueMovimiento({
  movimiento,
  cuentaId,
  monedaCuentaPago = null,
  cuentaBancariaPagoId = null,
  metodoPago = null,
  esAjuste = false,
}: {
  movimiento: MovimientoConciliado | null;
  cuentaId: string | null;
  /** Moneda del pago: sólo se usa si el movimiento es de la misma cuenta bancaria. */
  monedaCuentaPago?: string | null;
  cuentaBancariaPagoId?: string | null;
  /** MNY-P2.2: en efectivo no se espera movimiento bancario. */
  metodoPago?: string | null;
  /** Ajuste de saldo documental sin flujo de caja. */
  esAjuste?: boolean;
}) {
  if (!movimiento) {
    return (
      <section className="space-y-2">
        <SectionHeading as="h3" variant="subsection">Movimiento bancario</SectionHeading>
        <MovimientoAusente metodoPago={metodoPago} esAjuste={esAjuste} />
      </section>
    );
  }

  const esCargo = movimiento.cargo > 0;
  const monto = esCargo ? movimiento.cargo : movimiento.abono;
  const monedaMovimiento = monedaDelMovimiento(
    movimiento,
    cuentaBancariaPagoId,
    monedaCuentaPago,
  );
  return (
    <section className="space-y-2">
      <SectionHeading
        as="h3"
        variant="subsection"
        actions={
          <StatusBadge domain="conciliacion" status={movimiento.estado_conciliacion ?? "Pendiente"} />
        }
      >
        Movimiento bancario
      </SectionHeading>
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-body font-medium">{movimiento.concepto ?? "Movimiento del banco"}</p>
            <p className="text-body-sm text-muted-foreground">
              {formatDate(movimiento.fecha)} · {movimiento.cuenta_alias ?? "Cuenta"} ·{" "}
              {esCargo ? "Cargo" : "Abono"}
            </p>
            {movimiento.referencia ? (
              <p className="text-body-sm text-muted-foreground">Ref. {movimiento.referencia}</p>
            ) : null}
          </div>
          <span className={`whitespace-nowrap tabular-nums text-body font-semibold ${esCargo ? "text-destructive" : "text-success"}`}>
            {esCargo ? "−" : "+"} {formatCurrency(monto, monedaMovimiento)}
          </span>
        </div>
        {movimiento.conciliado_at ? (
          <p className="text-2xs text-muted-foreground">
            Conciliado el {formatDate(movimiento.conciliado_at)}
          </p>
        ) : null}
        {cuentaId ? (
          <Link
            to={`/tesoreria/estado-cuenta?cuenta=${cuentaId}`}
            className="inline-flex items-center gap-1 text-body-sm font-medium text-primary hover:underline"
          >
            <Landmark className="h-3.5 w-3.5" />
            Ver en el estado de cuenta
          </Link>
        ) : null}
      </div>
    </section>
  );
}

