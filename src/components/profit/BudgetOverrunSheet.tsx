/**
 * Fase J · Drilldown lateral desde el KPI "Cumplim. presupuesto".
 * Muestra las categorías con cumplimiento >110% con una barra de progreso
 * clampada a 100% (los excesos se comunican con un badge aparte para no
 * distorsionar la escala visual).
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters/numbers";
import { ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { FilaVsReal } from "@/features/presupuesto/services";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  filas: FilaVsReal[];
  periodo: string;
}

/** Tono según severidad del cumplimiento — verde ≤100, ámbar 100–110, rojo >110. */
function toneFor(pct: number): { bar: string; badge: "secondary" | "default" | "destructive" } {
  if (pct > 110) return { bar: "bg-destructive", badge: "destructive" };
  if (pct > 100) return { bar: "bg-warning", badge: "default" };
  return { bar: "bg-success", badge: "secondary" };
}

function BarraCumplimiento({ pct }: { pct: number }) {
  const tono = toneFor(pct);
  const ancho = Math.min(100, Math.max(0, pct));
  return (
    <div className="h-2 rounded bg-muted overflow-hidden" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full transition-all", tono.bar)} style={{ width: `${ancho}%` }} />
    </div>
  );
}

export function BudgetOverrunSheet({ open, onOpenChange, filas, periodo }: Props) {
  const navigate = useNavigate();
  const irADetalle = () => {
    onOpenChange(false);
    navigate(`/profit/presupuesto?periodo_vs_real=${periodo}`);
  };
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto" data-testid="budget-overrun-sheet">
        <SheetHeader>
          <SheetTitle>Categorías fuera de presupuesto</SheetTitle>
          <SheetDescription>
            Categorías con cumplimiento &gt; 110% en {periodo}. Enfócate en éstas primero.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {filas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Ninguna categoría excede el 110% este mes.
            </p>
          ) : (
            <ul className="space-y-3">
              {filas.map((f) => {
                const tono = toneFor(f.cumplimiento_pct);
                return (
                  <li key={f.categoria_id} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium truncate">{f.categoria_nombre}</span>
                      <Badge variant={tono.badge} className="shrink-0 text-2xs">
                        {f.cumplimiento_pct.toFixed(0)}%
                      </Badge>
                    </div>
                    <BarraCumplimiento pct={f.cumplimiento_pct} />
                    <div className="flex items-center justify-between text-xs text-muted-foreground tabular-nums">
                      <span>
                        {formatCurrency(f.real_mxn, "MXN")} / {formatCurrency(f.presupuesto_mxn, "MXN")}
                      </span>
                      <span className="font-medium text-destructive">
                        +{formatCurrency(f.variacion_mxn, "MXN")}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="mt-6">
          <Button variant="outline" className="w-full" onClick={irADetalle}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Ver presupuesto completo
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
