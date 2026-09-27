import { Badge } from "@/components/ui/badge";
import { etiquetaTratamientoFila, tratamientoIvaPendiente } from "@/lib/financial/etiquetaTratamientoFila";
import { ivaDeFila } from "@/features/embarques/domain/ivaConceptoVenta";
import type { Tables } from "@/types/db";

type ConceptoVenta = Tables<"conceptos_venta">;

/** Mostrar el tratamiento guardado; apagar un traslado no lo convierte en exento/no objeto. */
export function TratamientoIvaProforma({ concepto, ivaActivo }: {
  concepto: ConceptoVenta;
  ivaActivo: boolean;
}) {
  const pendiente = tratamientoIvaPendiente(concepto);
  const sinTraslado = concepto.moneda === "USD" && !ivaActivo && ivaDeFila(concepto) && !pendiente;
  return (
    <div className="flex flex-col items-center gap-1">
      <Badge variant={pendiente ? "outline" : "secondary"} className="whitespace-nowrap text-body-sm">
        {etiquetaTratamientoFila(concepto)}
      </Badge>
      {sinTraslado && <span className="max-w-36 whitespace-normal text-label text-muted-foreground">Sin traslado en esta proforma</span>}
    </div>
  );
}
