/** Lista de tarifas con conflicto; el usuario marca cuáles conservar. */
import { Checkbox } from "@/components/ui/checkbox";
import { formatUSD } from "@/lib/formatters";
import type { TarifaImport } from "./importarTarifas";
import type { Conflicto } from "./duplicadosTarifas";

interface Props {
  tarifas: readonly TarifaImport[];
  conflictos: readonly Conflicto[];
  seleccion: ReadonlySet<number>;
  onToggle: (indice: number, conservar: boolean) => void;
}

export function ConflictosTarifasLista({ tarifas, conflictos, seleccion, onToggle }: Props) {
  if (conflictos.length === 0) return null;
  return (
    <div className="space-y-2 rounded-md border p-3">
      <p className="font-medium">
        {conflictos.length} tarifa(s) ya existen o vienen repetidas. Marca las que quieras cargar de todos modos:
      </p>
      <ul className="max-h-56 space-y-2 overflow-auto">
        {conflictos.map((c) => {
          const t = tarifas[c.indice];
          return (
            <li key={c.indice} className="flex items-start gap-2">
              <Checkbox
                id={`conf-${c.indice}`}
                checked={seleccion.has(c.indice)}
                onCheckedChange={(v) => onToggle(c.indice, v === true)}
              />
              <label htmlFor={`conf-${c.indice}`} className="text-body-sm">
                Fila {t.fila}: {formatUSD(t.input.flete_base)} ({t.input.vigente_desde} → {t.input.vigente_hasta})
                <span className="block text-muted-foreground">
                  {c.tipo === "existente"
                    ? `Ya existe una tarifa en ${c.estadoOtro} de ${formatUSD(c.fleteOtro)} (${c.vigenciaOtro}).`
                    : `Repetida en este lote con la ${c.estadoOtro} de ${formatUSD(c.fleteOtro)}.`}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
