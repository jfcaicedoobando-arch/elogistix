/**
 * Resumen visual del traspaso: qué sale de la cuenta origen, con qué tipo de
 * cambio se convierte y cuánto llega a la cuenta destino.
 */
import { ArrowDown } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { resumenTraspaso } from "@/features/tesoreria/domain/traspasoResumen";
import type { MonedaTc } from "@/features/tesoreria/domain/tcPar";

interface Props {
  monedaOrigen: string;
  monedaDestino: string;
  montoOrigen: number;
  comision: number;
  montoDestino: number;
  /** Par del tipo de cambio; null cuando ambas cuentas son de la misma moneda. */
  par: { base: MonedaTc; quote: MonedaTc } | null;
  tcQuote: number;
}

function Renglon({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className={muted ? "text-body-sm text-muted-foreground" : "text-body-sm"}>{label}</span>
      <span className={muted ? "text-body-sm tabular-nums text-muted-foreground" : "text-body-sm tabular-nums"}>
        {value}
      </span>
    </div>
  );
}

export function TraspasoResumen({
  monedaOrigen, monedaDestino, montoOrigen, comision, montoDestino, par, tcQuote,
}: Props) {
  const r = resumenTraspaso({ montoOrigen, comision, montoDestino });
  const conversion = !!par && tcQuote > 0;

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-2">
      <Renglon label="Monto a transferir" value={formatCurrency(r.montoOrigen, monedaOrigen)} />
      {r.comision > 0 && (
        <Renglon label="Comisión bancaria" value={formatCurrency(r.comision, monedaOrigen)} muted />
      )}
      <Renglon
        label="Cargo total en la cuenta origen"
        value={formatCurrency(r.totalCargoOrigen, monedaOrigen)}
        muted
      />
      {conversion && (
        <Renglon
          label="Tipo de cambio aplicado"
          value={`1 ${par.base} = ${tcQuote} ${par.quote}`}
          muted
        />
      )}
      <div className="flex items-center gap-2 pt-1 text-muted-foreground">
        <ArrowDown className="size-4" aria-hidden />
        <span className="text-body-sm">Se abona en la cuenta destino</span>
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
        <span className="text-body font-medium">Llega a la cuenta destino</span>
        <span className="text-h4 font-semibold tabular-nums text-primary">
          {formatCurrency(r.montoDestino, monedaDestino)}
        </span>
      </div>
    </div>
  );
}
