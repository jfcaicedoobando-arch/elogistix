/**
 * Avisos del renglón de vinculación (falta T/C, exceso vs cotizado, T/C aplicado).
 * Extraído de `VincularConceptoRow` para mantener la complejidad ciclomática
 * dentro del límite del proyecto.
 */
import { AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  sinTc: boolean;
  monedaCosto: string;
  facturaMoneda: string;
  mismaMoneda: boolean;
  excede: boolean;
  cotizadoEnFactura: number | null;
  implicito: number | null;
  desviado: boolean;
}

const fmtTc = (n: number) => n.toFixed(4);

export function VincularConceptoAvisos({
  sinTc, monedaCosto, facturaMoneda, mismaMoneda, excede, cotizadoEnFactura, implicito, desviado,
}: Props) {
  const equivalente =
    cotizadoEnFactura !== null && !mismaMoneda
      ? ` (${formatCurrency(cotizadoEnFactura, facturaMoneda)} al T/C DOF)`
      : "";

  return (
    <>
      {sinTc && (
        <p className="mt-0.5 flex items-center gap-1 text-label text-warning">
          <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
          Costo en {monedaCosto} y factura en {facturaMoneda}: falta el tipo de cambio DOF de la
          fecha de emisión. Regístralo en Configuración → Tipo de cambio DOF para poder vincular.
        </p>
      )}
      {excede && (
        <p className="mt-0.5 flex items-start gap-1 text-label text-destructive">
          <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
          <span>
            El importe asignado supera lo cotizado{equivalente}. Siguiente paso: baja el importe a
            lo cotizado, o déjalo así si el proveedor realmente cobró más — la diferencia se
            registrará como ajuste de costo en el embarque al guardar.
          </span>
        </p>
      )}
      {implicito !== null && (
        <p className={`mt-0.5 text-label tabular-nums ${desviado ? "text-warning" : "text-muted-foreground"}`}>
          T/C aplicado: {fmtTc(implicito)}
          {desviado && " · se desvía más de 2% del DOF, verifica el importe"}
        </p>
      )}
    </>
  );
}
