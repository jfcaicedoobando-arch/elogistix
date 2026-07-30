/**
 * Franja de identidad del Estado de cuenta (estilo statement de Odoo/QuickBooks):
 * cliente, RFC, condiciones de crédito y periodo/fecha de corte.
 */
import { Card } from "@/components/ui/card";
import { Building2 } from "lucide-react";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";

interface Props {
  nombre?: string | null;
  rfc?: string | null;
  diasCredito?: number | null;
  limiteCreditoMxn?: number | null;
  desde?: string | null;
  hasta?: string | null;
  loading?: boolean;
}

function Dato({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium tabular-nums whitespace-nowrap">{value}</div>
    </div>
  );
}

export function EstadoCuentaHeaderCard({
  nombre,
  rfc,
  diasCredito,
  limiteCreditoMxn,
  desde,
  hasta,
  loading,
}: Props) {
  const periodo =
    desde && hasta ? `${formatDate(desde)} – ${formatDate(hasta)}` : "Histórico completo";
  const corte = formatDate(hasta ?? new Date().toISOString().slice(0, 10));

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="rounded-md bg-accent/10 p-2">
            <Building2 className="h-5 w-5 text-accent" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">
              {loading ? "Cargando…" : toTitleCase(nombre ?? "") || "Cliente"}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="font-mono uppercase">{rfc || "Sin RFC"}</span>
              <span>·</span>
              <span>
                Crédito: {typeof diasCredito === "number" ? `${diasCredito} días` : "No definido"}
              </span>
              {typeof limiteCreditoMxn === "number" && limiteCreditoMxn > 0 && (
                <>
                  <span>·</span>
                  <span className="tabular-nums">
                    Límite {formatCurrency(limiteCreditoMxn, "MXN")}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 gap-6 border-t pt-3 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <Dato label="Periodo" value={periodo} />
          <Dato label="Corte al" value={corte} />
        </div>
      </div>
    </Card>
  );
}
