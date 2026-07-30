import { KpiCard } from "@/components/shared/KpiCard";
import { AlertCircle, CircleDollarSign, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { KpisEstadoCuenta } from "../services/estadoCuentaAggregates";

interface Props {
  kpis: KpisEstadoCuenta;
  loading?: boolean;
}

/**
 * Importe principal + secundario cuando hay saldo en las dos monedas.
 * `KpiCard` no respeta saltos de línea, así que el segundo importe se manda
 * al sublabel en vez de concatenarlo (antes se truncaba en 1366 px).
 */
function dual(mxn: number, usd: number): { value: string; extra: string | null } {
  if (mxn > 0 && usd > 0) {
    return { value: formatCurrency(mxn, "MXN"), extra: `+ ${formatCurrency(usd, "USD")}` };
  }
  if (usd > 0) return { value: formatCurrency(usd, "USD"), extra: null };
  return { value: formatCurrency(mxn, "MXN"), extra: null };
}

function sublabel(extra: string | null, fallback: string): string {
  return extra ? `${extra} · ${fallback}` : fallback;
}

export function EstadoCuentaKpiCards({ kpis, loading }: Props) {
  const adeudado = dual(kpis.adeudado.mxn, kpis.adeudado.usd);
  const vencido = dual(kpis.vencido.mxn, kpis.vencido.usd);
  const aFavor = dual(kpis.aFavor.mxn, kpis.aFavor.usd);

  const adeudadoTotal = kpis.adeudado.mxn + kpis.adeudado.usd;
  const vencidoTotal = kpis.vencido.mxn + kpis.vencido.usd;
  const aFavorTotal = kpis.aFavor.mxn + kpis.aFavor.usd;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        label="Saldo total adeudado"
        value={adeudado.value}
        valueTooltip={`${formatCurrency(kpis.adeudado.mxn, "MXN")} · ${formatCurrency(kpis.adeudado.usd, "USD")}`}
        sublabel={sublabel(
          adeudado.extra,
          kpis.facturasAdeudadas > 0
            ? `${kpis.facturasAdeudadas} factura(s) con saldo`
            : "Sin adeudos",
        )}
        icon={CircleDollarSign}
        variant={adeudadoTotal > 0 ? "warning" : "default"}
        loading={loading}
      />
      <KpiCard
        label="Saldo vencido"
        value={vencido.value}
        valueTooltip={`${formatCurrency(kpis.vencido.mxn, "MXN")} · ${formatCurrency(kpis.vencido.usd, "USD")}`}
        sublabel={sublabel(
          vencido.extra,
          kpis.facturasVencidas > 0
            ? `${kpis.facturasVencidas} factura(s) vencida(s)`
            : "Al corriente",
        )}
        icon={AlertCircle}
        variant={vencidoTotal > 0 ? "destructive" : "success"}
        loading={loading}
      />
      <KpiCard
        label="Saldo a favor / anticipos"
        value={aFavor.value}
        sublabel={sublabel(aFavor.extra, aFavorTotal > 0 ? "Disponible para aplicar" : "Sin anticipos")}
        icon={PiggyBank}
        variant={aFavorTotal > 0 ? "success" : "default"}
        loading={loading}
      />
    </div>
  );
}
