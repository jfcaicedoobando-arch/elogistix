import { Input } from "@/components/ui/input";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
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
  const filas = (["subtotal", "iva", "ieps", "retenciones", "total"] as const).map((campo) => ({
    campo,
    etiqueta: campo === "iva" || campo === "ieps" ? campo.toUpperCase() : campo[0].toUpperCase() + campo.slice(1),
    anterior: anterior[campo],
    nuevo: nuevo[campo],
  }));
  const columnas = defineColumns<(typeof filas)[number]>([
    { id: "importe", header: `Importe (${moneda})`, accessorKey: "etiqueta", enableSorting: false },
    { id: "actual", header: "Actual", accessorKey: "anterior", enableSorting: false,
      cell: ({ row }) => formatCurrency(row.original.anterior, moneda),
      meta: { align: "right", className: "tabular-nums whitespace-nowrap" } },
    { id: "nuevo", header: "Al guardar", accessorKey: "nuevo", enableSorting: false,
      cell: ({ row }) => formatCurrency(row.original.nuevo, moneda),
      meta: { align: "right", className: "tabular-nums whitespace-nowrap" } },
  ]);
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
      <section aria-label="Importes antes y después de guardar" className="rounded-md border">
        <h3 className="px-3 py-2 text-body-sm font-medium">Importes antes y después de guardar</h3>
        <DataTable data={filas} columns={columnas} rowKey={(fila) => fila.campo}
          density="compact" striped={false} hoverable={false} tableClassName="w-full"
          rowClassName={(fila) => fila.campo === "total" ? "font-semibold" : ""} />
      </section>
    </div>
  );
}
