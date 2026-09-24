import { formatCurrency, fraccionAPorcentaje } from "@/lib/formatters";
import { useTasaIVA } from "@/features/catalogos/hooks/useTasaIVA";

/** Nota fiscal: no infiere tasa 0/exento/no objeto de un IVA cero. */
function notaIvaCotizacion(o: {
  hayDesglose: boolean; mostrarUSD: boolean; mostrarMXN: boolean;
  sinIva: boolean; monedasConIva: string | null; tasaPct: string;
}): string | null {
  if (o.hayDesglose && !o.mostrarUSD && !o.mostrarMXN) return null;
  if (o.sinIva) return "* Sin IVA trasladado en los conceptos mostrados.";
  if (o.monedasConIva) {
    return `* Los conceptos en ${o.monedasConIva} incluyen IVA según la tasa de cada concepto (general ${o.tasaPct}).`;
  }
  return `* Los conceptos en MXN incluyen IVA ${o.tasaPct}`;
}

interface Props {
  totalUSD: number;
  totalMXN: number;
  /** B-101: ocultar la línea de una moneda sin conceptos (default: visible,
   *  para no cambiar los call-sites internos existentes). */
  mostrarUSD?: boolean;
  mostrarMXN?: boolean;
  /** B-081: cuando el caller desglosa el IVA por moneda, la nota al pie
   *  refleja el cálculo real en lugar de afirmar que solo MXN lleva IVA. */
  ivaUSD?: number;
  ivaMXN?: number;
}

export default function ResumenTotalesCotizacion({
  totalUSD,
  totalMXN,
  mostrarUSD = true,
  mostrarMXN = true,
  ivaUSD,
  ivaMXN,
}: Props) {
  // R6-FIX2: la tasa nunca se escribe a mano; sale del helper central.
  const tasaIva = useTasaIVA();
  const tasaPct = `${fraccionAPorcentaje(tasaIva)}%`;
  const hayDesglose = ivaUSD !== undefined || ivaMXN !== undefined;
  const monedasConIva = hayDesglose
    ? [
        ivaUSD != null && ivaUSD > 0 ? "USD" : null,
        mostrarMXN && (ivaMXN == null || ivaMXN > 0) ? "MXN" : null,
      ].filter(Boolean).join(" y ")
    : null;
  const sinIva = hayDesglose && !monedasConIva;

  const nota = notaIvaCotizacion({ hayDesglose, mostrarUSD, mostrarMXN, sinIva, monedasConIva, tasaPct });

  return (
    <div className="flex flex-col items-end gap-1 p-4 border rounded-md bg-muted/30">
      {mostrarUSD && (
        <span className="text-base font-bold">
          {/* Bug 5: se etiqueta la base — este total sí incluye el IVA de los
              conceptos en USD que lo llevan; el margen se calcula sin IVA. */}
          {ivaUSD != null && ivaUSD > 0 ? "Total USD (c/IVA):" : "Total USD:"} {formatCurrency(totalUSD, 'USD')}
        </span>
      )}
      {mostrarMXN && (
        <span className="text-base font-bold">
          {sinIva ? "Total MXN:" : "Total MXN (c/IVA):"} {formatCurrency(totalMXN, 'MXN')}
        </span>
      )}
      {nota && <span className="text-body-sm text-muted-foreground">{nota}</span>}
    </div>
  );
}

