/**
 * Badge tri-estado para conceptos de venta en el tab Facturación.
 *
 * Desde v13.213.47 `conceptos_venta.estado_facturacion` es tri-valor real en BD
 * (`pendiente` | `en_proforma` | `facturado`), sincronizado automáticamente por
 * el trigger `trg_sync_conceptos_venta_facturado` sobre `proformas`. Ya no
 * hay que cruzar con `proformas.estado_proforma` en presentación.
 */
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/types/db";

/**
 * v13.823.366 — `pendiente_confirmar`: el embarque sigue en Borrador, así que
 * el concepto todavía no puede pasar a proforma. Es señal de presentación: en
 * BD `estado_facturacion` sigue siendo `pendiente`.
 */
export type EstadoConcepto = "pendiente" | "pendiente_confirmar" | "en_proforma" | "facturado";

type ConceptoVenta = Tables<"conceptos_venta">;

/**
 * Mapa `conceptoId → estado tri-valor` leído directo de BD.
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
): Map<string, EstadoConcepto> {
  const mapa = new Map<string, EstadoConcepto>();
  for (const c of conceptos) {
    const ef = c.estado_facturacion;
    if (ef === "facturado") mapa.set(c.id, "facturado");
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
        <CheckCircle2 className="h-3 w-3 mr-1" /> Facturado
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
      <Clock className="h-3 w-3 mr-1" /> Listo para proforma
    </Badge>
  );
}
