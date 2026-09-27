import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/formatters";
import { parseMonto } from "@/lib/format/parseMonto";
import type { ImpuestosNoDesglosados, ImportesFacturaConceptos } from "../utils/impuestosConceptos";

interface Props {
  anterior: ImportesFacturaConceptos;
  nuevo: ImportesFacturaConceptos;
  moneda: string;
  globales: { iva: string; ieps: string };
  mostrarGlobales: boolean;
  onGlobales: (campo: keyof ImpuestosNoDesglosados, valor: string) => void;
}

export function ImportesEdicionConceptos({ anterior, nuevo, moneda, globales, mostrarGlobales, onGlobales }: Props) {
  return (
    <div className="space-y-3">
      {mostrarGlobales && (
        <fieldset className="space-y-2 rounded-md border bg-muted/20 p-3">
          <legend className="px-1 text-body-sm font-medium">Impuestos globales sin desglose en partidas</legend>
          <p className="text-body-sm text-muted-foreground">
            Se conservan al editar. Si los distribuyes en los conceptos, reduce aquí el importe global
            correspondiente para no duplicarlo. No se asignan automáticamente a ningún concepto.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["iva", "ieps"] as const).map((campo) => (
              <label key={campo} className="space-y-1 text-body-sm">
                <span>{campo.toUpperCase()} global sin desglose ({moneda})</span>
                <Input inputMode="decimal" value={globales[campo]}
                  aria-label={`${campo.toUpperCase()} global sin desglose`}
                  onChange={(e) => onGlobales(campo, e.target.value)}
                  onBlur={() => onGlobales(campo, parseMonto(globales[campo]).toFixed(2))} />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-body-sm tabular-nums">
          <caption className="px-3 py-2 text-left font-medium">Importes antes y después de guardar</caption>
          <thead className="bg-muted/30"><tr>
            <th scope="col" className="p-2 text-left">Importe ({moneda})</th>
            <th scope="col" className="p-2 text-right">Actual</th>
            <th scope="col" className="p-2 text-right">Al guardar</th>
          </tr></thead>
          <tbody>{(["subtotal", "iva", "ieps", "retenciones", "total"] as const).map((campo) => (
            <tr key={campo} className={campo === "total" ? "border-t font-semibold" : "border-t"}>
              <th scope="row" className="p-2 text-left font-medium">{campo === "iva" || campo === "ieps" ? campo.toUpperCase() : campo[0].toUpperCase() + campo.slice(1)}</th>
              <td className="p-2 text-right">{formatCurrency(anterior[campo], moneda)}</td>
              <td className="p-2 text-right">{formatCurrency(nuevo[campo], moneda)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
