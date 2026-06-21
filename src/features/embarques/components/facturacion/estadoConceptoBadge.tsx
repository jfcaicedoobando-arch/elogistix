/**
 * Badge tri-estado para conceptos de venta en el tab Facturación.
 *
 * El campo `conceptos_venta.estado_facturacion` es binario en BD
 * (`pendiente` | `en_proforma`). El estado "facturado" se deriva en presentación
 * cruzando con `proformas.estado_proforma === 'facturada'`.
 */
import { CheckCircle2, Clock, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/types/db";

export type EstadoConcepto = "pendiente" | "en_proforma" | "facturado";

type ConceptoVenta = Tables<"conceptos_venta">;
type ProformaRow = Pick<Tables<"proformas">, "id" | "estado_proforma">;

/** Calcula el mapa `conceptoId → estado tri-valor` a partir de proformas. */
export function calcularEstadosConceptos(
  conceptos: ConceptoVenta[],
  proformas: ProformaRow[],
): Map<string, EstadoConcepto> {
  const proformaPorId = new Map(proformas.map((p) => [p.id, p]));
  const mapa = new Map<string, EstadoConcepto>();
  for (const c of conceptos) {
    if (c.estado_facturacion !== "en_proforma") {
      mapa.set(c.id, "pendiente");
      continue;
    }
    const prof = c.proforma_id ? proformaPorId.get(c.proforma_id) : null;
    if (prof?.estado_proforma === "facturada") {
      mapa.set(c.id, "facturado");
    } else {
      mapa.set(c.id, "en_proforma");
    }
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
