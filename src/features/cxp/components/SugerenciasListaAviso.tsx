/**
 * Bloque de aviso con la lista de conceptos sugeridos que NO se pre-marcaron.
 * Extraído de `SugerenciasOperacionesBanda` para respetar el techo de
 * complejidad (Power-of-10) al añadir el caso "sin tipo de cambio".
 */
import { formatCurrency } from "@/lib/formatters/numbers";
import type { ConceptoSugeridoEntrante } from "@/features/cxp/services/facturasEntrantesConceptos";

interface Props {
  items: readonly ConceptoSugeridoEntrante[];
  /** Texto que explica por qué quedaron fuera. */
  motivo: string;
}

export function SugerenciasListaAviso({ items, motivo }: Props) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-0.5 text-body-sm text-warning">
      <p>
        {items.length} sugerencia{items.length === 1 ? "" : "s"} no se marcó porque {motivo}
      </p>
      <ul className="space-y-0.5">
        {items.map((c) => (
          <li key={c.conceptoCostoId}>
            {c.concepto} · {formatCurrency(c.monto, c.moneda)}
          </li>
        ))}
      </ul>
    </div>
  );
}
