import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { buildConceptosFromCostos } from "@/features/cotizacion/domain/cotizacion.conceptos";
import type { ConceptoVentaCotizacion, FilaCostoLocal } from "@/features/cotizacion/types";

interface Props {
  esEdicion: boolean;
  pricingSolicitudId?: string | null;
  origenesConfirmados: ReadonlySet<string>;
  onIrACostos: () => void;
  costos: FilaCostoLocal[];
  ventas: ConceptoVentaCotizacion[];
  tasaIva: number;
  onPreparar: (ventas: ConceptoVentaCotizacion[]) => void;
}

/** Una captura vacía no prueba que el usuario quiera recuperar ventas borradas. */
export function RecuperarConceptosDesdeCostos({ esEdicion, pricingSolicitudId, origenesConfirmados, onIrACostos, costos, ventas, tasaIva, onPreparar }: Props) {
  if (!esEdicion || !pricingSolicitudId) return null;
  if (ventas.some(v => v.descripcion?.trim())) return null;
  const conConcepto = costos.filter(c => c.concepto.trim());
  if (!conConcepto.some(c => c.cantidad > 0 && c.precio_venta > 0)) return null;
  const origenCompleto = conConcepto.every(c => Boolean(c.origen_venta_id && origenesConfirmados.has(c.origen_venta_id)));
  const preparar = () => {
    if (!origenCompleto || ventas.some(v => v.descripcion?.trim())) return;
    const { usd, mxn } = buildConceptosFromCostos(conConcepto, tasaIva);
    onPreparar([...usd, ...mxn]);
  };

  return <Alert variant="warning" data-testid="recuperar-ventas-desde-costos">
    <AlertTitle>Hay costos con venta y la captura de conceptos está vacía</AlertTitle>
    <AlertDescription className="space-y-2">
      <p>Puedes preparar los conceptos desde los costos guardados. Esta acción sólo cambia la captura; revisa los importes y captura el tipo de cambio si corresponde antes de guardar.</p>
      {!origenCompleto && <p>Hay vínculos de costos que aún no están guardados. Ve a Costos y utilidad y pulsa Siguiente para guardarlos antes de preparar los conceptos.</p>}
      <Button type="button" size="sm" variant="outline" disabled={!origenCompleto} onClick={preparar}>
        Preparar conceptos desde costos
      </Button>
      {!origenCompleto && <Button type="button" size="sm" variant="outline" onClick={onIrACostos}>Ir a Costos y utilidad</Button>}
    </AlertDescription>
  </Alert>;
}
