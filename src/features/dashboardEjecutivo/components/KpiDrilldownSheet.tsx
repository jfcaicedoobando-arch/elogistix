/**
 * KpiDrilldownSheet — panel lateral reutilizable que muestra la lista subyacente
 * a un KPI del Dashboard Ejecutivo (Top deudores, Top acreedores, etc.). Evita
 * la fricción de "clic en KPI → pantalla completa" ofreciendo un vistazo rápido
 * con opción de navegar al módulo para ver todos.
 *
 * v13.300.33 · Batch E · drill-downs de KPIs
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters/numbers";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { TopItem } from "@/features/tesoreria/services";

export interface KpiDrilldownProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  items: TopItem[];
  emptyText?: string;
  verTodosHref: string;
  verTodosLabel?: string;
  /** Dirección semántica de `dias`: positivo=vencido (rojo) o positivo=por vencer (ámbar). */
  diasTone?: "vencido" | "porVencer";
}

function badgeVariant(dias: number | undefined, tone: "vencido" | "porVencer"): "destructive" | "default" | "secondary" {
  if (!dias || dias <= 0) return "secondary";
  if (tone === "vencido") return dias > 30 ? "destructive" : "default";
  return dias <= 7 ? "destructive" : "default";
}

function labelDias(dias: number | undefined, tone: "vencido" | "porVencer"): string | null {
  if (typeof dias !== "number" || dias === 0) return null;
  if (tone === "vencido") return dias > 0 ? `${dias} d vencido` : `${Math.abs(dias)} d por vencer`;
  return dias > 0 ? `Vence en ${dias} d` : `Vencido ${Math.abs(dias)} d`;
}

export function KpiDrilldownSheet({
  open,
  onOpenChange,
  title,
  description,
  items,
  emptyText = "Sin registros.",
  verTodosHref,
  verTodosLabel = "Ver todos en el módulo",
  diasTone = "vencido",
}: KpiDrilldownProps) {
  const navigate = useNavigate();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="kpi-drilldown-sheet">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{emptyText}</p>
          ) : (
            <ul className="divide-y">
              {items.slice(0, 10).map((it, i) => {
                const lbl = labelDias(it.dias, diasTone);
                return (
                  <li key={`${it.nombre}-${i}`} className="py-2 flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{it.nombre}</p>
                      {lbl && (
                        <Badge variant={badgeVariant(it.dias, diasTone)} className="mt-0.5 text-2xs">
                          {lbl}
                        </Badge>
                      )}
                    </div>
                    <span className="tabular-nums font-semibold shrink-0">
                      {formatCurrency(it.saldo, it.moneda)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => { onOpenChange(false); navigate(verTodosHref); }}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            {verTodosLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
