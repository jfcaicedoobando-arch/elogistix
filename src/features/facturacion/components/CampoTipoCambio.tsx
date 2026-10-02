/**
 * TC del cobro cross-moneda: sugiere el DOF de la fecha de pago y permite el
 * TC convenido con el cliente (Guía de llenado REP 2.0, campo EquivalenciaDR).
 * La fecha del pago nunca se altera para "cuadrar" el saldo.
 */
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumericInput } from "@/components/shared/NumericInput";
import type { PagoFormValues } from "./PagoFormFields";
import {
  TC_MAX, TC_MIN, tcCuadreExacto, tcManualValido, tcParaPago, type RatesTc,
} from "./registrarPagoDerivados";

export interface CampoTcProps {
  values: PagoFormValues;
  onChange: <K extends keyof PagoFormValues>(k: K, v: PagoFormValues[K]) => void;
  monedaFactura: string;
  saldo: number;
  rates: RatesTc | undefined;
}

export function CampoTipoCambio({ values, onChange, monedaFactura, saldo, rates }: CampoTcProps) {
  // Sólo pago en MXN sobre factura extranjera (o al revés); USD↔EUR lo bloquea la BD.
  const aplica = values.moneda !== monedaFactura && (values.moneda === "MXN" || monedaFactura === "MXN");
  if (!aplica) return null;
  const sugerido = tcParaPago(values.moneda, monedaFactura, rates);
  const manual = values.tipoCambioManual ?? "";
  const fueraBanda = tcManualValido(manual) === null;
  const cuadre = values.moneda === "MXN" ? tcCuadreExacto(Number(values.monto) || 0, saldo) : null;
  const cuadreValido = cuadre !== null && tcManualValido(String(cuadre)) !== null;
  const actual = manual ? Number(manual) : (sugerido ?? 0);
  const divisa = values.moneda === "MXN" ? monedaFactura : values.moneda;

  return (
    <div className="sm:col-span-2 space-y-1">
      <Label htmlFor="pago-tc">Tipo de cambio (MXN por {divisa})</Label>
      <NumericInput
        id="pago-tc"
        aria-label="Tipo de cambio del pago"
        decimals
        value={actual}
        onChange={(n) => onChange("tipoCambioManual", n === 0 ? "" : String(n))}
        className="h-10 text-right tabular-nums"
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-label text-muted-foreground">{textoAyuda(manual, sugerido)}</p>
        {manual && (
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onChange("tipoCambioManual", "")}>
            Usar DOF
          </Button>
        )}
        {cuadreValido && cuadre !== actual && (
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => onChange("tipoCambioManual", String(cuadre))}>
            Liquidar saldo exacto ({cuadre.toFixed(4)})
          </Button>
        )}
      </div>
      {fueraBanda && (
        <p className="text-label text-destructive">
          El tipo de cambio debe estar entre {TC_MIN} y {TC_MAX}.
        </p>
      )}
    </div>
  );
}

function textoAyuda(manual: string, sugerido: number | null): string {
  if (!manual) return "Sugerido: DOF publicado para la fecha de pago.";
  return `TC convenido con el cliente. DOF de la fecha: ${sugerido?.toFixed(4) ?? "no disponible"}.`;
}
