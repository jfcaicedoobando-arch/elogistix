/**
 * Tarjeta ejecutiva de fuga financiera. Suma MXN de los hallazgos
 * financieros pendientes y los desglosa por regla.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingDown } from "lucide-react";
import type { ReglaAuditoria } from "@/types/auditoria";

interface Props {
  total: number;
  porRegla: Partial<Record<ReglaAuditoria, number>>;
}

const reglaLabel: Partial<Record<ReglaAuditoria, string>> = {
  margen_negativo: "Margen negativo",
  margen_bajo: "Margen bajo",
  proforma_vencida: "Proformas vencidas",
};

const fmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

export function AuditoriaRiesgoFinancieroCard({ total, porRegla }: Props) {
  const items = Object.entries(porRegla)
    .filter(([, v]) => (v ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <TrendingDown className="h-4 w-4 text-warning" />
          Riesgo financiero pendiente
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-3xl font-bold tabular-nums text-warning">
          {fmt.format(total)}
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Sin fugas financieras detectadas en los embarques actuales.
          </p>
        ) : (
          <div className="space-y-1 text-xs">
            {items.map(([regla, monto]) => (
              <div
                key={regla}
                className="flex items-center justify-between border-t pt-1 first:border-t-0 first:pt-0"
              >
                <span className="text-muted-foreground">
                  {reglaLabel[regla as ReglaAuditoria] ?? regla}
                </span>
                <span className="font-semibold tabular-nums">
                  {fmt.format(monto ?? 0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
