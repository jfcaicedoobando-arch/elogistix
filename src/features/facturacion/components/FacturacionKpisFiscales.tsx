/**
 * KPIs específicos del flujo fiscal FacturApi (pendiente 8 del plan).
 * Complementa al `DashboardEjecutivoFacturacion` (que muestra montos)
 * con conteos accionables: cuántas proformas se pueden convertir hoy,
 * cuántas facturas siguen en Borrador sin CFDI, y cuántos REPs no se
 * han timbrado tras un pago PPD.
 */
import { Card, CardContent } from "@/components/ui/card";
import { FileCheck2, FileWarning, Receipt } from "lucide-react";
import { useFacturacionKpisFiscales } from "@/features/facturacion/hooks/useFacturacionKpisFiscales";

interface KpiCardProps {
  label: string;
  value: number;
  Icon: typeof FileCheck2;
  tone: "info" | "warn" | "danger";
}

const toneClass = {
  info: "text-info",
  warn: "text-warning",
  danger: "text-destructive",
} as const;

function KpiCard({ label, value, Icon, tone }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <Icon className={`h-8 w-8 ${toneClass[tone]}`} />
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tabular-nums">{value}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export function FacturacionKpisFiscales() {
  const { data, isLoading } = useFacturacionKpisFiscales();
  if (isLoading || !data) return null;
  if (data.proformasConvertibles + data.facturasSinTimbrar + data.repsPendientes === 0) {
    return null;
  }
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
      <KpiCard
        label="Proformas convertibles"
        value={data.proformasConvertibles}
        Icon={FileCheck2}
        tone="info"
      />
      <KpiCard
        label="Facturas sin timbrar"
        value={data.facturasSinTimbrar}
        Icon={FileWarning}
        tone="warn"
      />
      <KpiCard
        label="REPs pendientes"
        value={data.repsPendientes}
        Icon={Receipt}
        tone="danger"
      />
    </div>
  );
}
