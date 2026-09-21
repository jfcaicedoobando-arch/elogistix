import { PenLine } from "lucide-react";
import { formatNumber } from "@/lib/formatters";
import { CANTIDAD_LIMITE_SANIDAD } from "../../utils/parseInputNumero";

/** Avisos inline del renglón (extraído para mantener la fila bajo el límite de complejidad). */
export function AvisosFilaCosto({
  gi,
  conceptoLibre,
  conceptoFaltante,
  proveedorFaltante,
  cantidadExcedida,
}: {
  gi: number;
  conceptoLibre: boolean;
  conceptoFaltante: boolean;
  proveedorFaltante: boolean;
  cantidadExcedida: boolean;
}) {
  if (!conceptoLibre && !conceptoFaltante && !proveedorFaltante && !cantidadExcedida) return null;
  return (
    <div className="mt-1 space-y-0.5">
      {conceptoLibre && (
        <p className="flex items-center gap-1 text-label text-warning" data-testid={`concepto-libre-aviso-${gi}`}>
          <PenLine className="h-3 w-3" /> Concepto libre: se pedirá la clave SAT al facturar.
        </p>
      )}
      {conceptoFaltante && (
        <p className="text-label text-destructive" data-testid={`concepto-faltante-aviso-${gi}`}>
          Selecciona el concepto de este renglón; sin nombre no se genera el concepto de venta.
        </p>
      )}
      {proveedorFaltante && !conceptoFaltante && (
        <p className="text-label text-destructive" data-testid={`proveedor-faltante-aviso-${gi}`}>
          Captura el proveedor de este renglón; sin proveedor el costo llega al expediente sin a quién pagarle.
        </p>
      )}
      {cantidadExcedida && (
        <p className="text-label text-destructive">
          Cantidad mayor a {formatNumber(CANTIDAD_LIMITE_SANIDAD)} — verifica el dato.
        </p>
      )}
    </div>
  );
}
