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

export type EstadoConcepto = "pendiente" | "en_proforma" | "facturado";

type ConceptoVenta = Tables<"conceptos_venta">;

/** Mapa `conceptoId → estado tri-valor` leído directo de BD. */
// eslint-disable-next-line react-refresh/only-export-components
export function calcularEstadosConceptos(
  conceptos: ConceptoVenta[],
): Map<string, EstadoConcepto> {
  const mapa = new Map<string, EstadoConcepto>();
  for (const c of conceptos) {
    const ef = c.estado_facturacion;
    if (ef === "facturado") mapa.set(c.id, "facturado");
    else if (ef === "en_proforma") mapa.set(c.id, "en_proforma");
    else mapa.set(c.id, "pendiente");
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
        <FileText className="h-3 w-3 mr-1" /> En proforma
      </Badge>
    );
  }
  return (
    <Badge variant="neutral">
      <Clock className="h-3 w-3 mr-1" /> Pendiente
    </Badge>
  );
}
