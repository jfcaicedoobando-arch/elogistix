/**
 * v13.507.0 — Explica al contador qué conceptos de costo sugirió operaciones al
 * subir el documento, y le deja quitarlos o volver a aplicarlos.
 */
import { Sparkles, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { ConceptoSugeridoEntrante } from "@/features/cxp/services/facturasEntrantesConceptos";

interface Props {
  aplicados: readonly ConceptoSugeridoEntrante[];
  descartados: readonly ConceptoSugeridoEntrante[];
  sinCostoCapturado: boolean;
  /** Cuántos conceptos están marcados ahora mismo en el formulario. */
  marcadosAhora: number;
  onQuitarTodos: () => void;
  onReaplicar: () => void;
}

export function SugerenciasOperacionesBanda({
  aplicados, descartados, sinCostoCapturado, marcadosAhora, onQuitarTodos, onReaplicar,
}: Props) {
  if (sinCostoCapturado && aplicados.length === 0 && descartados.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-2 text-body-sm text-muted-foreground">
        Operaciones indicó que este documento aún no corresponde a un costo capturado del embarque:
        vincúlalo a mano si ya existe el concepto.
      </p>
    );
  }
  if (aplicados.length === 0 && descartados.length === 0) return null;

  return (
    <section className="space-y-2 rounded-md border border-info/40 bg-info/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-body-sm font-medium">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-info" aria-hidden />
          Operaciones sugirió {aplicados.length} concepto{aplicados.length === 1 ? "" : "s"} de costo
          {aplicados.length > 0 ? " · ya vienen marcados" : ""}
        </p>
        <div className="flex gap-2">
          {marcadosAhora > 0 && (
            <Button size="sm" variant="ghost" onClick={onQuitarTodos}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Quitar todos
            </Button>
          )}
          {aplicados.length > 0 && (
            <Button size="sm" variant="ghost" onClick={onReaplicar}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Volver a aplicar
            </Button>
          )}
        </div>
      </div>

      {aplicados.length > 0 && (
        <ul className="space-y-0.5 text-body-sm text-muted-foreground">
          {aplicados.map((c) => (
            <li key={c.conceptoCostoId}>
              {c.concepto} · {formatCurrency(c.monto, c.moneda)}
            </li>
          ))}
        </ul>
      )}

      {descartados.length > 0 && (
        <div className="space-y-0.5 text-body-sm text-warning">
          <p>
            {descartados.length} sugerencia{descartados.length === 1 ? "" : "s"} no se marcó porque
            el concepto ya tiene otra factura vigente:
          </p>
          <ul className="space-y-0.5">
            {descartados.map((c) => (
              <li key={c.conceptoCostoId}>
                {c.concepto} · {formatCurrency(c.monto, c.moneda)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
