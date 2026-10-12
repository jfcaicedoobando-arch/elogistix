/**
 * Estado visual de conceptos: la bandera persistida reserva el concepto,
 * mientras la factura vinculada distingue preparación, emisión y terminales.
 */
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/types/db";
import { estadoFacturaConcepto, type EstadoConcepto, type FacturaConcepto, type ProformaConcepto } from "./estadoConceptoFactura";
export type { EstadoConcepto } from "./estadoConceptoFactura";

/**
 * v13.823.366 — `pendiente_confirmar`: el embarque sigue en Borrador, así que
 * el concepto todavía no puede pasar a proforma. Es señal de presentación: en
 * BD `estado_facturacion` sigue siendo `pendiente`.
 */
type ConceptoVenta = Tables<"conceptos_venta">;

/**
 * Mapa `conceptoId → estado visual`, sin cambiar reserva ni elegibilidad.
 *
 * v13.823.336 — fuente única de verdad: si el embarque no tiene ninguna
 * proforma viva, un concepto marcado `en_proforma` (bandera huérfana de una
 * proforma eliminada) se reporta como `pendiente`. Antes la fila decía
 * "En proforma" mientras el stepper decía "Sin proformas".
 */
// eslint-disable-next-line react-refresh/only-export-components
export function calcularEstadosConceptos(
  conceptos: ConceptoVenta[],
  hayProformas = true,
  /** `false` si el embarque sigue en Borrador (no puede generar proformas). */
  embarqueConfirmado = true,
  facturas: FacturaConcepto[] = [],
  proformas: ProformaConcepto[] = [],
): Map<string, EstadoConcepto> {
  const mapa = new Map<string, EstadoConcepto>();
  for (const c of conceptos) {
    const ef = c.estado_facturacion;
    if (ef === "facturado") mapa.set(c.id, estadoFacturaConcepto(c, facturas, proformas));
    else if (ef === "en_proforma" && hayProformas) mapa.set(c.id, "en_proforma");
    else mapa.set(c.id, embarqueConfirmado ? "pendiente" : "pendiente_confirmar");
  }
  return mapa;
}

interface BadgeProps {
  estado: EstadoConcepto;
}

export function EstadoConceptoBadge({ estado }: BadgeProps) {
  if (estado === "facturado") {
    return (
      <Badge variant="success">
        <CheckCircle2 className="h-3 w-3 mr-1" /> Emitido
      </Badge>
    );
  }
  const etiquetasFactura: Partial<Record<EstadoConcepto, string>> = {
    en_borrador: "En borrador", por_timbrar: "Por timbrar", en_factura: "En factura",
    factura_cancelada: "Factura cancelada", factura_sustituida: "Factura sustituida",
  };
  const etiquetaFactura = etiquetasFactura[estado];
  if (etiquetaFactura) {
    return (
      <Badge variant="outline">
        <FileText className="h-3 w-3 mr-1" /> {etiquetaFactura}
      </Badge>
    );
  }
  if (estado === "en_proforma") {
    return (
      <Badge variant="info">
        <FileText className="h-3 w-3 mr-1" /> Proforma generada
      </Badge>
    );
  }
  if (estado === "pendiente_confirmar") {
    return (
      <Badge variant="outline">
        <Clock className="h-3 w-3 mr-1" /> Pendiente de confirmar
      </Badge>
    );
  }
  return (
    <Badge variant="neutral">
      <Clock className="h-3 w-3 mr-1" /> Pendiente de proforma
    </Badge>
  );
}
