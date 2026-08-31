import { Receipt, Banknote, AlertCircle, Inbox } from "lucide-react";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { KpiCard } from "@/components/shared/KpiCard";
import { ROUTES } from "@/constants/routes";

interface Props {
  porFacturar: number;
  porPagarMxn: number;
  porPagarUsd: number;
  vencidoMxn: number;
  vencidoUsd: number;
  porCapturar: number;
  loading: boolean;
  /** Destino de la tarjeta "Por pagar" según los permisos del rol. */
  porPagarTo?: string;
}

export function HoyKpiRow({
  porFacturar,
  porPagarMxn,
  porPagarUsd,
  vencidoMxn,
  vencidoUsd,
  porCapturar,
  loading,
  porPagarTo = ROUTES.COMPRAS_POR_PAGAR,
}: Props) {
  const vencidoTotal = vencidoMxn > 0 || vencidoUsd > 0;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <KpiCard
        icon={Receipt}
        label="Por facturar"
        value={porFacturar}
        sublabel="Embarques con hueco"
        to={ROUTES.FACTURACION}
        variant={porFacturar > 0 ? "warning" : "default"}
        loading={loading}
      />
      <KpiCard
        icon={Banknote}
        label="Por pagar"
        value={formatCurrencyCompact(porPagarMxn, "MXN")}
        sublabel={porPagarUsd > 0 ? `+ ${formatCurrency(porPagarUsd, "USD")}` : "Facturas proveedor"}
        to={porPagarTo}
        variant="info"
        loading={loading}
      />
      <KpiCard
        icon={AlertCircle}
        label="Vencido (cartera)"
        value={formatCurrencyCompact(vencidoMxn, "MXN")}
        sublabel={vencidoUsd > 0 ? `+ ${formatCurrency(vencidoUsd, "USD")}` : "Cobranza"}
        to={ROUTES.CARTERA}
        variant={vencidoTotal ? "destructive" : "success"}
        loading={loading}
      />
      <KpiCard
        icon={Inbox}
        label="Por capturar (CxP)"
        value={porCapturar}
        sublabel="Conceptos sin factura"
        to={ROUTES.COMPRAS_POR_CAPTURAR}
        variant={porCapturar > 0 ? "warning" : "default"}
        loading={loading}
      />
    </div>
  );
}
