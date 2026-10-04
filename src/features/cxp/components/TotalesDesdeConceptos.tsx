import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";
import type { useTotalesConceptosCaptura } from "../hooks/useTotalesConceptosCaptura";

export function TotalesDesdeConceptos({ totales, moneda }: {
  totales: ReturnType<typeof useTotalesConceptosCaptura>;
  moneda: string;
}) {
  if (!totales.visible) return null;
  const propuesta = totales.propuesta;
  return <section aria-label="Totales propuestos desde conceptos" className="rounded-md border bg-muted/20 p-3 space-y-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-body-sm font-medium">Totales desde conceptos</p>
      <Button type="button" size="sm" variant="outline" disabled={!totales.puedeAplicar} onClick={totales.aplicar}>
        Usar totales de conceptos
      </Button>
    </div>
    {propuesta ? <dl className="flex flex-wrap gap-x-4 gap-y-1 text-body-sm tabular-nums">
      {(["subtotal", "iva", "ieps", "retenciones", "total"] as const).map((k) => <div key={k} className="flex gap-1">
        <dt>{k === "iva" || k === "ieps" ? k.toUpperCase() : k[0].toUpperCase() + k.slice(1)}:</dt>
        <dd>{formatCurrency(propuesta[k], moneda)}</dd>
      </div>)}
    </dl> : <p className="text-body-sm text-muted-foreground">Completa las partidas con cantidades e importes válidos antes de usar sus totales.</p>}
    <p className="text-label text-muted-foreground">
      Acción opcional para captura manual. Usa precios netos de descuentos; se suman IVA e IEPS capturados por partida y se conservan las retenciones de la factura. Revisa los importes en Datos de la factura.
    </p>
    {totales.difiere && <p role="status" className="text-body-sm text-warning">
      Los conceptos no coinciden con los importes de la factura. Revisa los cambios y vuelve a usar sus totales si corresponde; no se actualizan automáticamente.
    </p>}
  </section>;
}
