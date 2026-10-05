/**
 * Cabecera de cifras del estado de cuenta bancario (v13.450.0).
 * v13.5xx: migrado a `KpiCard` — plano por defecto, color sólo en alarma (saldo final negativo).
 */
import { KpiCard } from "@/components/shared/KpiCard";
import { formatDate } from "@/lib/formatters";
import type { EstadoCuentaBancario } from "@/features/tesoreria/domain/estadoCuenta";
import { resumenEstadoCuenta } from "@/features/tesoreria/services/estadoCuentaExport";

interface Props {
  estado?: EstadoCuentaBancario;
  isLoading: boolean;
}

export function EstadoCuentaResumen({ estado, isLoading }: Props) {
  const loading = isLoading || !estado;
  const saldoNegativo = (estado?.saldo_final ?? 0) < 0;
  const resumen = estado ? resumenEstadoCuenta(estado) : null;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Saldo inicial" value={resumen?.saldoInicial ?? ""} loading={loading} />
        <KpiCard label="Entradas" value={resumen?.entradas ?? ""} loading={loading} />
        <KpiCard label="Salidas" value={resumen?.salidas ?? ""} loading={loading} />
        <KpiCard
          label="Saldo final"
          value={resumen?.saldoFinal ?? ""}
          variant={saldoNegativo ? "destructive" : "default"}
          loading={loading}
        />
      </div>
      {resumen?.cobertura && <p role="status" className="text-body-sm text-muted-foreground">{resumen.cobertura}</p>}
      <ArranqueEstadoCuenta estado={estado} />
    </div>
  );
}

function ArranqueEstadoCuenta({ estado }: Pick<Props, "estado">) {
  if (!estado?.fecha_saldo_inicial) return null;
  return (
    <p className="text-body-sm text-muted-foreground">
      Arranque de la cuenta: saldo inicial al {formatDate(estado.fecha_saldo_inicial)}.
      {estado.movimientos_previos_corte > 0 && (
        <>
          {" "}
          {estado.movimientos_previos_corte} movimiento
          {estado.movimientos_previos_corte === 1 ? "" : "s"} con fecha anterior al arranque
          {estado.movimientos_previos_corte === 1 ? " no afecta" : " no afectan"} el saldo.
        </>
      )}
    </p>
  );
}
