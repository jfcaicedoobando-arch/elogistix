/**
 * Secciones editables del detalle de factura: botón de sustitución de CFDI,
 * card de configuración de timbrado y editor de conceptos.
 * v13.164.3: se removió el banner `FacturaFiscalCheckAlert` — ahora el
 * checklist fiscal del receptor vive en `FacturaReceptorCard`, con validación
 * inline por campo.
 */
import { Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FacturaDatosFiscalesCard } from "./FacturaDatosFiscalesCard";
import { FacturaConceptosEditor } from "./FacturaConceptosEditor";
import type { FacturaDetalle } from "@/features/facturacion/hooks";
import type { ConceptoFacturaRow } from "@/features/facturacion/services/conceptosFacturaCrud";

interface Props {
  factura: FacturaDetalle;
  canEdit: boolean;
  sinTimbrar: boolean;
  puedeEditarBorrador: boolean;
  conceptosVivos: ConceptoFacturaRow[];
  onSustituir: () => void;
}

export function FacturaDetalleEditableSections({
  factura, canEdit, sinTimbrar, puedeEditarBorrador, conceptosVivos, onSustituir,
}: Props) {
  const mostrarSustituir = canEdit && !sinTimbrar && factura.estado === "Emitida";

  return (
    <>
      {mostrarSustituir && (
        <Button variant="outline" size="sm" onClick={onSustituir} className="gap-1">
          <Replace className="h-4 w-4" /> Sustituir CFDI (motivo 01)
        </Button>
      )}

      {puedeEditarBorrador && <FacturaDatosFiscalesCard factura={factura} />}

      {puedeEditarBorrador && (
        <FacturaConceptosEditor
          facturaId={factura.id}
          organizationId={factura.organization_id}
          moneda={factura.moneda}
          conceptos={conceptosVivos}
        />
      )}
    </>
  );
}
