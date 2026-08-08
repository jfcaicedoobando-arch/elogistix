/**
 * Sub-piezas UI del drill-down de aging CxC (chips de cubeta + KPIs del cliente).
 * Separadas para respetar el límite de 200 líneas del diálogo.
 */
import { Download, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { CUBETA_LABELS, type CubetaAging } from "@/lib/aging/buckets";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";
import { Kpi } from "@/features/cxp/components/DialogDetallePagosProveedor.parts";

const CUBETA_CHIPS: Array<{ value: CubetaAging | "todas"; label: string }> = [
  { value: "todas", label: "Todas" },
  { value: "vigente", label: CUBETA_LABELS.vigente },
  { value: "d_1_30", label: CUBETA_LABELS.d_1_30 },
  { value: "d_31_60", label: CUBETA_LABELS.d_31_60 },
  { value: "d_61_90", label: CUBETA_LABELS.d_61_90 },
  { value: "mas_90", label: CUBETA_LABELS.mas_90 },
];

export function CxcAgingActionBar({
  cubeta, onChange, onExport, exportDisabled, exportCount,
}: {
  cubeta: CubetaAging | "todas";
  onChange: (c: CubetaAging | "todas") => void;
  onExport: () => void;
  exportDisabled: boolean;
  exportCount: number;
}) {
  return (
    <div className="px-6 py-3 border-b bg-accent/5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        {CUBETA_CHIPS.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-pressed={cubeta === c.value}
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-full border transition-colors",
              cubeta === c.value
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-muted text-muted-foreground border-border",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Más acciones">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={onExport} disabled={exportDisabled}>
            <Download className="h-3.5 w-3.5 mr-2" /> Exportar CSV ({exportCount})
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function CxcAgingKpiRow({ cliente }: { cliente: CxcAgingRow }) {
  const m = cliente.moneda;
  const vencido = cliente.d_1_30 + cliente.d_31_60 + cliente.d_61_90;
  return (
    <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b bg-background">
      <Kpi label={`Saldo total (${m})`} value={formatCurrency(cliente.saldo_total, m)} />
      <Kpi label="Vigente" value={formatCurrency(cliente.vigente, m)} />
      <Kpi
        label="Vencido 1-90 d"
        value={formatCurrency(vencido, m)}
        tone={vencido > 0 ? "warn" : "default"}
      />
      <Kpi
        label="Crítico +90 d"
        value={formatCurrency(cliente.mas_90, m)}
        tone={cliente.mas_90 > 0 ? "warn" : "default"}
        emphasis={cliente.mas_90 > 0}
      />
    </div>
  );
}
