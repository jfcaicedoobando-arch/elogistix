/**
 * Cinta superior de KPIs de Tesorería: saldo total en bancos, cartera por
 * cobrar y por pagar (30 días, convertidas a MXN) y flujo neto destacado.
 */
import { Banknote, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters/numbers";
import { ROUTES } from "@/constants/routes";
import type { ResumenTesoreria } from "@/features/tesoreria/domain";

interface Props {
  data: ResumenTesoreria;
}

function desgloseMonedas(saldos: Record<string, number>): string {
  return Object.entries(saldos)
    .map(([moneda, monto]) => formatCurrency(monto, moneda))
    .join(" · ");
}

export function TesoreriaKpis({ data }: Props) {
  const neto = data.flujo.por_cobrar_total_mxn - data.flujo.por_pagar_total_mxn;
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <KpiCard
        label="Saldo total en bancos"
        value={formatCurrency(data.saldo_bancos_mxn, "MXN")}
        sublabel={desgloseMonedas(data.saldos_por_moneda)}
        icon={Wallet}
        iconVariant="chip"
        variant="info"
        to={ROUTES.TESORERIA_CUENTAS}
        hint={
          data.saldo_bancos_incompleto
            ? "Excluye cuentas en divisa sin tipo de cambio confiable."
            : "Suma de saldos convertidos a MXN con el TC del DOF."
        }
      />
      <KpiCard
        label="Por cobrar 30 días"
        value={formatCurrency(data.flujo.por_cobrar_total_mxn, "MXN")}
        sublabel={
          data.cartera_vencida_count > 0
            ? `${data.cartera_vencida_count} vencidas · ${formatCurrency(data.cartera_vencida_total_mxn, "MXN")}`
            : "Sin facturas vencidas"
        }
        icon={TrendingUp}
        iconVariant="chip"
        variant="success"
        to={ROUTES.CARTERA}
      />
      <KpiCard
        label="Por pagar 30 días"
        value={formatCurrency(data.flujo.por_pagar_total_mxn, "MXN")}
        sublabel={
          data.cxp_vencidas_count > 0
            ? `${data.cxp_vencidas_count} vencidas · ${formatCurrency(data.cxp_vencidas_total_mxn, "MXN")}`
            : "Sin facturas vencidas"
        }
        icon={TrendingDown}
        iconVariant="chip"
        variant="warning"
        to={ROUTES.COMPRAS_POR_PAGAR}
      />
      <KpiCard
        label="Flujo neto 30 días"
        value={formatCurrency(neto, "MXN")}
        sublabel={neto >= 0 ? "Cobros mayores a pagos" : "Los pagos superan los cobros"}
        icon={Banknote}
        iconVariant="chip"
        variant={neto >= 0 ? "success" : "destructive"}
        to={ROUTES.TESORERIA_FLUJO}
      />
    </div>
  );
}
