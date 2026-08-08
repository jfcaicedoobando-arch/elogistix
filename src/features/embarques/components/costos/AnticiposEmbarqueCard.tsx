/**
 * Tarjeta "Anticipos a proveedores ligados a este embarque" (pestaña Costos).
 * Da visibilidad al dinero que ya salió del banco antes de recibir la factura.
 */
import { Ship } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { formatCurrency } from "@/lib/formatters";
import { formatDate } from "@/lib/formatters/dates";
import { useAnticiposPorEmbarque } from "@/features/anticipos-proveedor/hooks/useAnticiposPorEmbarque";

const ETIQUETA_ESTADO: Record<string, { texto: string; tone: "success" | "warning" | "neutral" | "destructive" }> = {
  disponible: { texto: "Pendiente de factura", tone: "warning" },
  aplicado_parcial: { texto: "Aplicado parcial", tone: "warning" },
  aplicado_total: { texto: "Aplicado a factura", tone: "success" },
  cancelado: { texto: "Cancelado", tone: "destructive" },
};

export function AnticiposEmbarqueCard({ embarqueId }: { embarqueId?: string }) {
  const { data: anticipos, isLoading } = useAnticiposPorEmbarque(embarqueId);

  if (!embarqueId || isLoading || anticipos.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Ship className="h-4 w-4 text-muted-foreground" />
          Anticipos a proveedores de este embarque
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {anticipos.map((a) => {
          const et = ETIQUETA_ESTADO[a.estado] ?? { texto: a.estado, tone: "neutral" as const };
          return (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{a.proveedor_nombre ?? "Proveedor"}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(a.fecha_anticipo)}
                  {a.referencia ? ` · Ref. ${a.referencia}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(Number(a.monto), a.moneda)}
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    Sin aplicar: {formatCurrency(Number(a.saldo_disponible), a.moneda)}
                  </p>
                </div>
                <ToneBadge tone={et.tone}>{et.texto}</ToneBadge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
