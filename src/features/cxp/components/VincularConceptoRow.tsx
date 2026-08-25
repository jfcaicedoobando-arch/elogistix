/**
 * Renglón de un concepto_costo pendiente dentro del paso "Vincular a costos de
 * embarque" del wizard de captura de factura de proveedor.
 *
 * Regla de moneda (Ola conciliación multi-moneda): el importe aplicado se
 * captura SIEMPRE en la moneda de la factura. Si el costo está cotizado en otra
 * moneda se muestra su equivalencia con el T/C DOF de la fecha de emisión y el
 * T/C implícito de lo capturado.
 */
import { AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Hint } from "@/components/shared/Hint";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { formatCurrency, formatFechaEs } from "@/lib/formatters";
import {
  convertirMonto,
  desviacionTcExcedida,
  excedeCotizadoConTc,
  factorConversion,
  tcImplicito,
  type TcPivote,
} from "@/features/cxp/utils/vinculoMoneda";
import type { ConceptoCostoAbierto } from "@/features/cxp/hooks";
import type { SeleccionLinea } from "@/features/cxp/types";

interface Props {
  concepto: ConceptoCostoAbierto;
  seleccion: SeleccionLinea | undefined;
  onToggle: (concepto: ConceptoCostoAbierto, checked: boolean) => void;
  onChangeMonto: (conceptoId: string, monto: number) => void;
  /** Moneda de la factura que se está capturando. */
  facturaMoneda: string;
  /** T/C DOF de la fecha de emisión (pivote MXN). */
  tc: TcPivote | null;
  /** Fecha de publicación DOF usada (ISO). */
  tcFecha?: string | null;
}

const fmtTc = (n: number) => n.toFixed(4);

export function VincularConceptoRow({
  concepto: it, seleccion: sel, onToggle, onChangeMonto,
  facturaMoneda, tc, tcFecha,
}: Props) {
  const checked = !!sel;
  const mismaMoneda = it.moneda === facturaMoneda;
  const factor = factorConversion(it.moneda, facturaMoneda, tc);
  const cotizadoEnFactura = convertirMonto(it.monto, it.moneda, facturaMoneda, tc);
  const sinTc = !mismaMoneda && cotizadoEnFactura === null;

  const excede =
    checked &&
    excedeCotizadoConTc({
      montoCapturado: Number(sel.monto) || 0,
      montoCotizado: it.monto,
      factorDof: factor,
      mismaMoneda,
    });
  const implicito = checked && !mismaMoneda ? tcImplicito(Number(sel.monto) || 0, it.monto) : null;
  const desviado = desviacionTcExcedida(implicito, factor);


  const handleToggle = (v: boolean) => {
    onToggle(it, v);
    if (v && !mismaMoneda && cotizadoEnFactura !== null) {
      onChangeMonto(it.id, cotizadoEnFactura);
    }
  };

  return (
    <div className="px-3 py-2 flex items-center gap-3 text-body">
      <Checkbox
        checked={checked}
        disabled={sinTc}
        onCheckedChange={(v) => handleToggle(!!v)}
        aria-label={`Vincular ${it.concepto}`}
      />
      <div className="flex-1 min-w-0">
        <Hint label={it.concepto}><div className="truncate">{it.concepto}</div></Hint>
        <div className="text-body-sm text-muted-foreground tabular-nums">
          Cotizado: {formatCurrency(it.monto, it.moneda)}
          {!mismaMoneda && cotizadoEnFactura !== null && factor !== null && (
            <span>
              {" ≈ "}
              <span className="font-medium text-foreground">
                {formatCurrency(cotizadoEnFactura, facturaMoneda)}
              </span>
              {` (T/C DOF ${fmtTc(factor)}`}
              {tcFecha ? ` · ${formatFechaEs(tcFecha)}` : ""}
              {")"}
            </span>
          )}

        </div>
        {sinTc && (
          <p className="mt-0.5 flex items-center gap-1 text-label text-warning">
            <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
            Costo en {it.moneda} y factura en {facturaMoneda}: falta el tipo de cambio DOF de la
            fecha de emisión. Regístralo en Configuración → Tipo de cambio DOF para poder vincular.
          </p>
        )}
        {excede && (
          <p className="mt-0.5 flex items-start gap-1 text-label text-destructive">
            <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
            <span>
              El importe asignado supera lo cotizado
              {cotizadoEnFactura !== null && !mismaMoneda
                ? ` (${formatCurrency(cotizadoEnFactura, facturaMoneda)} al T/C DOF)`
                : ""}
              . Siguiente paso: baja el importe a lo cotizado, o déjalo así si el proveedor
              realmente cobró más — la diferencia se registrará como ajuste de costo en el
              embarque al guardar.
            </span>
          </p>
        )}
        {implicito !== null && (
          <p className={`mt-0.5 text-label tabular-nums ${desviado ? "text-warning" : "text-muted-foreground"}`}>
            T/C aplicado: {fmtTc(implicito)}
            {desviado && " · se desvía más de 2% del DOF, verifica el importe"}
          </p>
        )}
      </div>
      {checked && (
        <div className="flex items-center gap-1.5">
          <span className="text-body-sm text-muted-foreground">{facturaMoneda}</span>
          <MoneyInput
            value={sel.monto}
            onChange={(n: number) => onChangeMonto(it.id, n)}
            aria-invalid={excede || undefined}
            aria-label={`Importe aplicado al concepto ${it.concepto} en ${facturaMoneda}`}
            className={`w-28 h-8 ${excede ? "border-destructive text-destructive" : ""}`}
          />
        </div>
      )}
    </div>
  );
}
