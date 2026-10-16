/** Lista desplegable: tarifas por cargar, agrupadas por proveedor del correo. */
import { useMemo } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { formatUSD } from "@/lib/formatters";
import { agruparPorProveedor } from "./agruparProveedor";
import type { TarifaImport } from "./importarTarifas";

interface Props {
  tarifas: readonly TarifaImport[];
  proveedorDe: ReadonlyMap<string, string>;
  nombreAgenteDe: ReadonlyMap<string, string>;
  puertos: ReadonlyMap<string, string>;
  navieras: ReadonlyMap<string, string>;
}

export function TarifasPorProveedor({ tarifas, proveedorDe, nombreAgenteDe, puertos, navieras }: Props) {
  const grupos = useMemo(
    () => agruparPorProveedor(tarifas, proveedorDe, nombreAgenteDe),
    [tarifas, proveedorDe, nombreAgenteDe],
  );
  if (grupos.length === 0) return null;
  return (
    <Accordion type="single" collapsible className="rounded-md border p-3">
      <p className="font-medium">Tarifas por proveedor (toca el nombre para verlas):</p>
      {grupos.map((g) => (
        <AccordionItem key={g.proveedor} value={g.proveedor}>
          <AccordionTrigger className="text-body-sm">
            {g.proveedor} — {g.indices.length} tarifa(s) por cargar
          </AccordionTrigger>
          <AccordionContent>
            <ul className="max-h-64 space-y-1 overflow-auto">
              {g.indices.map((i) => {
                const t = tarifas[i];
                const ruta = `${puertos.get(t.origenId) ?? "?"} → ${puertos.get(t.destinoId) ?? "?"}`;
                return (
                  <li key={i} className="text-body-sm">
                    Fila {t.fila}: {ruta} · {navieras.get(t.input.naviera_id) ?? "?"} · {formatUSD(t.input.flete_base)}
                    <span className="text-muted-foreground"> ({t.input.vigente_desde} → {t.input.vigente_hasta})</span>
                  </li>
                );
              })}
            </ul>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
