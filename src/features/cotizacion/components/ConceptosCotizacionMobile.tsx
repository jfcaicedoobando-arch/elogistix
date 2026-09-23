import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { calcularIVA, calcularSubtotal, resolverTasaConcepto } from "@/lib/financial/financialUtils";
import { importeEfectivoConcepto } from "@/lib/domain/cotizacionDetalle";
import { etiquetaTratamientoFila } from "@/lib/financial/etiquetaTratamientoFila";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";

export function ConceptosCotizacionMobile({ conceptos, moneda, tasaIva }: {
  conceptos: ConceptoVentaCotizacion[];
  moneda: "USD" | "MXN";
  tasaIva: number;
}) {
  return <ul aria-label={`Conceptos móviles en ${moneda}`} className="divide-y rounded-md border md:hidden">{conceptos.map((c, i) => {
    const base = calcularSubtotal(c.cantidad, c.precio_unitario);
    const iva = calcularIVA(base, resolverTasaConcepto(c, tasaIva));
    const total = moneda === "MXN" ? base + iva : importeEfectivoConcepto(c, tasaIva);
    return <li key={c.id ?? `${c.descripcion}-${i}`} className="space-y-2 p-3">
      <p className="font-medium text-body break-words">{c.descripcion ?? "—"}</p>
      <div className="flex flex-wrap items-center justify-between gap-2"><Badge variant="neutral" size="sm">IVA: {etiquetaTratamientoFila(c)}</Badge><span className="font-semibold tabular-nums">{formatCurrency(total, moneda)}</span></div>
      <p className="text-label text-muted-foreground">{c.cantidad} {c.unidad_medida || "unidad"} · Base {formatCurrency(base, moneda)}</p>
    </li>;
  })}</ul>;
}