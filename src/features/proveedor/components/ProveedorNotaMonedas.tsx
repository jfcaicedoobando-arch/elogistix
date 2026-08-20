/**
 * Nota al pie del resumen del proveedor: desglose en moneda nativa, aviso de
 * T/C estimado (EC-10) y monedas que quedaron fuera del equivalente en MXN.
 *
 * v13.660.0 — Extraído de `ProveedorResumenCards` para bajar la complejidad
 * ciclomática del componente contenedor por debajo del límite del lint.
 */
import { formatCurrency } from "@/lib/formatters";

interface Props {
  /** Pares [moneda, monto] con saldo distinto de cero. */
  monedasNativas: [string, number][];
  /** Monedas con saldo que no se pudieron convertir a MXN. */
  monedasSinTc: string[];
  /** El equivalente en MXN se calculó con el T/C de respaldo. */
  tcEstimado: boolean;
}

export function ProveedorNotaMonedas({ monedasNativas, monedasSinTc, tcEstimado }: Props) {
  const variasMonedas = monedasNativas.length > 1;
  if (!variasMonedas && monedasSinTc.length === 0) return null;

  return (
    <div className="text-body-sm text-muted-foreground">
      {tcEstimado ? (
        <span className="text-warning">
          Equivalente calculado con T/C estimado (no oficial) ·{" "}
        </span>
      ) : null}
      {variasMonedas ? (
        <span>
          Desglose nativo:{" "}
          {monedasNativas.map(([mon, monto]) => formatCurrency(monto, mon)).join(" · ")}
        </span>
      ) : null}
      {monedasSinTc.length > 0 ? (
        <span className="text-warning">
          {variasMonedas ? " · " : ""}
          {monedasSinTc.join(", ")} sin tipo de cambio: no se incluye en el equivalente
        </span>
      ) : null}
    </div>
  );
}
