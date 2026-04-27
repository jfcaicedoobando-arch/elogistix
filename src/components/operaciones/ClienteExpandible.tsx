import { memo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { toTitleCase } from "@/lib/formatters";
import type { OperadorData } from "@/hooks/operaciones/useOperacionesData";
import { ESTADOS_KEYS } from "@/hooks/operaciones/useDesempenoChartData";
import { ESTADO_COLOR, ESTADO_ICON } from "./desempenoVisuals";

export const ClienteExpandible = memo(function ClienteExpandible({ cliente }: { cliente: OperadorData["clientesDesglose"][number] }) {
  const [open, setOpen] = useState(false);
  const estadosConValor = ESTADOS_KEYS.filter((e) => cliente.desgloseEstados[e] > 0);

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full group">
          <div className="flex items-center justify-between text-[11px] gap-2 py-1 px-1 rounded hover:bg-muted/60 transition-colors">
            <span className="flex items-center gap-1 min-w-0 text-foreground">
              <ChevronRight
                className={`h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-200 ${
                  open ? "rotate-90" : ""
                }`}
              />
              <span className="truncate" title={cliente.nombre}>{toTitleCase(cliente.nombre)}</span>
            </span>
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 shrink-0 tabular-nums"
            >
              {cliente.cantidad}
            </Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="ml-5 mt-1 mb-1.5 pl-2 border-l border-border space-y-1">
            {estadosConValor.length === 0 ? (
              <p className="text-[10px] text-muted-foreground italic py-1">Sin desglose</p>
            ) : (
              estadosConValor.map((estado) => {
                const Icon = ESTADO_ICON[estado];
                return (
                  <div
                    key={estado}
                    className="flex items-center justify-between text-[10px] gap-2"
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon className="h-3 w-3" style={{ color: ESTADO_COLOR[estado] }} />
                      {estado}
                    </span>
                    <span
                      className="font-semibold tabular-nums"
                      style={{ color: ESTADO_COLOR[estado] }}
                    >
                      {cliente.desgloseEstados[estado]}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
});
