import { KpiCard } from "@/components/shared/KpiCard";
import { AlertCircle, CircleDollarSign, PiggyBank } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { KpisEstadoCuenta } from "../services/estadoCuentaAggregates";

interface Props {
  kpis: KpisEstadoCuenta;
  loading?: boolean;
}

function formatDual(mxn: number, usd: number): string {
  if (mxn > 0 && usd > 0) return `${formatCurrency(mxn, "MXN")}\n${formatCurrency(usd, "USD")}`;
  if (usd > 0) return formatCurrency(usd, "USD");
  return formatCurrency(mxn, "MXN");
}

export function EstadoCuentaKpiCards({ kpis, loading }: Props) {
  const adeudadoTotal = kpis.adeudado.mxn + kpis.adeudado.usd;
  const vencidoTotal = kpis.vencido.mxn + kpis.vencido.usd;
  const aFavorTotal = kpis.aFavor.mxn + kpis.aFavor.usd;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard
        label="Saldo Total Adeudado"
        value={formatDual(kpis.adeudado.mxn, kpis.adeudado.usd)}
        sublabel={
          kpis.facturasAdeudadas > 0
            ? `${kpis.facturasAdeudadas} factura(s) con saldo`
            : "Sin adeudos"
        }
        icon={CircleDollarSign}
        variant={adeudadoTotal > 0 ? "warning" : "default"}
        loading={loading}
      />
      <KpiCard
        label="Saldo Vencido"
        value={formatDual(kpis.vencido.mxn, kpis.vencido.usd)}
        sublabel={
          kpis.facturasVencidas > 0
            ? `${kpis.facturasVencidas} factura(s) vencida(s)`
            : "Al corriente"
        }
        icon={AlertCircle}
        variant={vencidoTotal > 0 ? "destructive" : "success"}
        loading={loading}
      />
      <KpiCard
        label="Saldo a Favor / Anticipos"
        value={formatDual(kpis.aFavor.mxn, kpis.aFavor.usd)}
        sublabel={aFavorTotal > 0 ? "Disponible para aplicar" : "Sin anticipos"}
        icon={PiggyBank}
        variant={aFavorTotal > 0 ? "success" : "default"}
        loading={loading}
      />
    </div>
  );
}
