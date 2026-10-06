import { KpiCard } from "@/components/shared/KpiCard";
import { AlertCircle, CircleDollarSign, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import { pluralizar } from "@/lib/format/pluralizar";
import type { KpiPorMoneda, KpisEstadoCuenta } from "../services/estadoCuentaAggregates";
import type { Moneda } from "../services/estadoCuentaTypes";

interface Props {
  kpis: KpisEstadoCuenta;
  loading?: boolean;
}

const MONEDAS: Record<keyof KpiPorMoneda, Moneda> = { mxn: "MXN", usd: "USD", eur: "EUR" };

/** Un importe visible por moneda, sin sumar nominales ni truncar una tercera divisa. */
function importes(montos: KpiPorMoneda) {
  const valores = (Object.keys(MONEDAS) as (keyof KpiPorMoneda)[])
    .filter((key) => montos[key] > 0)
    .map((key) => formatCurrency(montos[key], MONEDAS[key]));
  return { valores: valores.length ? valores : [formatCurrency(0, "MXN")], tieneSaldo: valores.length > 0 };
}

function ImportesAdicionales({ valores, loading }: { valores: string[]; loading?: boolean }) {
  if (loading) return null;
  return valores.slice(1).map((valor) => (
    <p key={valor} className="text-body font-semibold tabular-nums break-words">+ {valor}</p>
  ));
}

export function EstadoCuentaKpiCards({ kpis, loading }: Props) {
  const adeudado = importes(kpis.adeudado);
  const vencido = importes(kpis.vencido);
  const aFavor = importes(kpis.aFavor);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label="Saldo total adeudado"
        value={adeudado.valores[0]}
        valueTooltip={adeudado.valores.join(" · ")}
        sublabel={kpis.facturasAdeudadas > 0
          ? `${pluralizar(kpis.facturasAdeudadas, "factura")} con saldo`
          : "Sin adeudos"}
        icon={CircleDollarSign}
        variant={adeudado.tieneSaldo ? "warning" : "default"}
        loading={loading}
      >
        <ImportesAdicionales valores={adeudado.valores} loading={loading} />
      </KpiCard>
      <KpiCard
        label="Saldo vencido"
        value={vencido.valores[0]}
        valueTooltip={vencido.valores.join(" · ")}
        sublabel={kpis.facturasVencidas > 0
          ? `${pluralizar(kpis.facturasVencidas, "factura")} ${kpis.facturasVencidas === 1 ? "vencida" : "vencidas"}`
          : "Al corriente"}
        icon={AlertCircle}
        variant={vencido.tieneSaldo ? "destructive" : "success"}
        loading={loading}
      >
        <ImportesAdicionales valores={vencido.valores} loading={loading} />
      </KpiCard>
      <KpiCard
        label="Saldo a favor / anticipos"
        value={aFavor.valores[0]}
        valueTooltip={aFavor.valores.join(" · ")}
        sublabel={aFavor.tieneSaldo ? "Disponible para aplicar" : "Sin anticipos"}
        icon={PiggyBank}
        variant={aFavor.tieneSaldo ? "success" : "default"}
        loading={loading}
      >
        <ImportesAdicionales valores={aFavor.valores} loading={loading} />
      </KpiCard>
    </div>
  );
}
