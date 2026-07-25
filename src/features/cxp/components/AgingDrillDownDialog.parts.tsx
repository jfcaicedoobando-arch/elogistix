/**
 * Sub-piezas UI del AgingDrillDownDialog extraídas para respetar el
 * límite de 200 líneas del contenedor principal.
 */
import { Download, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import type { CubetaAging } from "./agingBuckets";
import type { CxpAgingRow } from "@/features/cxp/services/cxpAging";
import { Kpi } from "./DialogDetallePagosProveedor.parts";

export function AgingActionBar({
  cubeta, onChange, onExport, exportDisabled, exportCount,
}: {
  cubeta: CubetaAging | "todas";
  onChange: (c: CubetaAging | "todas") => void;
  onExport: () => void;
  exportDisabled: boolean;
  exportCount: number;
}) {
  const CUBETA_CHIPS: Array<{ value: CubetaAging | "todas"; label: string }> = [
    { value: "todas", label: "Todas" },
    { value: "vigente", label: "Vigente" },
    { value: "d_1_30", label: "1-30 d" },
    { value: "d_31_60", label: "31-60 d" },
    { value: "d_61_90", label: "61-90 d" },
    { value: "mas_90", label: ">90 d" },
  ];
  return (
    <div className="px-6 py-3 border-b bg-accent/5 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 flex-wrap">
        {CUBETA_CHIPS.map((c) => (
          <button
            key={c.value}
            onClick={() => onChange(c.value)}
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

export function AgingKpiRow({ proveedor }: { proveedor: CxpAgingRow }) {
  const criticas = proveedor.mas_90;
  const porVencer = proveedor.vigente;
  const vencido = proveedor.d_1_30 + proveedor.d_31_60 + proveedor.d_61_90;
  const m = proveedor.moneda;
  return (
    <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 border-b bg-background">
      <Kpi label={`Saldo total (${m})`} value={formatCurrency(proveedor.saldo_total, m)} />
      <Kpi label="Por vencer" value={formatCurrency(porVencer, m)} />
      <Kpi
        label="Vencido 1-90 d"
        value={formatCurrency(vencido, m)}
        tone={vencido > 0 ? "warn" : "default"}
      />
      <Kpi
        label="Crítico >90 d"
        value={formatCurrency(criticas, m)}
        tone={criticas > 0 ? "warn" : "default"}
        emphasis={criticas > 0}
      />
    </div>
  );
}
