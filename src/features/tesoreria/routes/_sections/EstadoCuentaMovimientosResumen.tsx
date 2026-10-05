import { totalesVisibles, type EstadoCuentaBancario, type MovimientoEstadoCuenta } from "@/features/tesoreria/domain/estadoCuenta";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  estado?: EstadoCuentaBancario;
  visibles: MovimientoEstadoCuenta[];
  moneda: string;
}

export function EstadoCuentaMovimientosResumen({ estado, visibles, moneda }: Props) {
  const sinCobertura = estado?.cobertura_historica === "sin_cobertura";
  const totales = totalesVisibles(visibles);
  return (
    <div className="flex flex-wrap justify-between gap-2 px-1 text-body-sm text-muted-foreground">
      <span>
        {sinCobertura ? "Historial no disponible" : `${visibles.length} de ${estado?.movimientos.length ?? 0} movimientos`}
        {estado ? ` · ${estado.alias}` : ""}
      </span>
      {!sinCobertura && <span className="tabular-nums">
        Entradas visibles {formatCurrency(totales.entradas, moneda)} · Salidas visibles{" "}
        {formatCurrency(totales.salidas, moneda)}
      </span>}
    </div>
  );
}
