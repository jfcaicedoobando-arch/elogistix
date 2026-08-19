/**
 * Totales del periodo por moneda, calculados en el servidor (FIX C3c).
 * Se muestran sin convertir para no mezclar divisas con tipos de cambio dudosos.
 */
import { Card } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { formatCurrency } from "@/lib/formatters/numbers";
import { formatDate } from "@/lib/formatters/dates";
import type { DireccionTotales } from "@/features/dashboard/direccion/services/loaders";

const BLOQUES: Array<{ key: keyof Pick<DireccionTotales, "ventas" | "costos" | "facturado" | "cobrado">; label: string }> = [
  { key: "ventas", label: "Ventas" },
  { key: "costos", label: "Costos" },
  { key: "facturado", label: "Facturado" },
  { key: "cobrado", label: "Cobrado" },
];

function MonedasList({ montos }: { montos: Record<string, number> }) {
  const entradas = Object.entries(montos ?? {}).filter(([, v]) => Number(v) !== 0);
  if (entradas.length === 0) {
    return <EmptyStateInline icon={Wallet} message="Sin movimientos" className="py-2" />;
  }
  return (
    <ul className="mt-1 space-y-0.5">
      {entradas.map(([moneda, monto]) => (
        <li key={moneda} className="text-sm tabular-nums">
          {/* VB-04: formatCurrency ya incluye el código ISO; no repetirlo como sufijo. */}
          {formatCurrency(Number(monto), moneda)}

        </li>
      ))}
    </ul>
  );
}

interface Props {
  totales?: DireccionTotales;
  desdeIso: string;
  isLoading: boolean;
}

export function TotalesPeriodoCard({ totales, desdeIso, isLoading }: Props) {
  return (
    <Card className="p-5 rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Totales del periodo por moneda
        </p>
        <p className="text-xs text-muted-foreground">
          Desde {formatDate(desdeIso)} · {totales?.embarques ?? 0} embarques
        </p>
      </div>
      {isLoading || !totales ? (
        <KpiGridSkeleton count={BLOQUES.length} heightClass="h-14" className="mt-3" />
      ) : (
        <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          {BLOQUES.map((b) => (
            <div key={b.key}>
              <p className="text-xs font-medium text-muted-foreground">{b.label}</p>
              <MonedasList montos={totales[b.key]} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
