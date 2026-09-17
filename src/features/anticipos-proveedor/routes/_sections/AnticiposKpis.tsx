/** KPIs de la bandeja de anticipos a proveedores. */
import { useMemo } from "react";
import { HandCoins, Wallet, CheckCircle2 } from "lucide-react";
import { KpiStrip } from "@/components/shared/KpiStrip";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import { calcularKpisAnticipos } from "../../domain/kpisAnticipos";
import type { AnticipoProveedorRow } from "../../hooks/useAnticiposProveedor";

interface Props {
  anticipos: AnticipoProveedorRow[];
}

const enTextos = (pares: Array<[string, number]>) =>
  pares.map(([moneda, v]) => formatCurrency(v, moneda));

export function AnticiposKpis({ anticipos }: Props) {
  const { pendientes, disponible, anticipado, aplicado } = useMemo(() => {
    const k = calcularKpisAnticipos(anticipos);
    return {
      pendientes: k.pendientes,
      disponible: enTextos(k.disponible),
      anticipado: enTextos(k.anticipado),
      aplicado: enTextos(k.aplicado),
    };
  }, [anticipos]);


  return (
    <KpiStrip desktopCols={4} className="mb-6">
      <KpiCard
        label="Anticipos por aplicar"
        value={pendientes}
        icon={HandCoins}
        iconVariant="chip"
        sublabel="Con saldo a favor vigente"
      />
      <KpiCard
        label="Saldo a favor disponible"
        value={disponible.length > 0 ? disponible.join(" · ") : "—"}
        icon={Wallet}
        iconVariant="chip"
        variant="accent"
        sublabel="Dinero adelantado sin consumir"
      />
      <KpiCard
        label="Total anticipado"
        value={anticipado.length > 0 ? anticipado.join(" · ") : "—"}
        icon={HandCoins}
        sublabel="Suma de anticipos vigentes"
      />
      <KpiCard
        label="Aplicado a facturas"
        value={aplicado.length > 0 ? aplicado.join(" · ") : "—"}
        icon={CheckCircle2}
        variant={aplicado.length > 0 ? "success" : "default"}
        sublabel="Ya cruzado contra facturas"
      />
    </KpiStrip>
  );
}
