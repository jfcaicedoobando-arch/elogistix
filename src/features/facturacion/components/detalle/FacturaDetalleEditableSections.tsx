/**
 * Secciones editables del detalle de factura: card de configuración de
 * timbrado y editor de conceptos. La acción "Sustituir CFDI" vive ahora
 * en `FacturaDetalleActions` para homologar el diseño (v13.172.22).
 */
import { FacturaDatosFiscalesCard } from "./FacturaDatosFiscalesCard";
import { FacturaConceptosEditor } from "./FacturaConceptosEditor";
import type { FacturaDetalle } from "@/features/facturacion/hooks";
import type { ConceptoFacturaRow } from "@/features/facturacion/services/conceptosFacturaCrud";

interface Props {
  factura: FacturaDetalle;
  canEdit: boolean;
  puedeEditarBorrador: boolean;
  conceptosVivos: ConceptoFacturaRow[];
}

export function FacturaDetalleEditableSections({
  factura, puedeEditarBorrador, conceptosVivos,
}: Props) {
  if (!puedeEditarBorrador) return null;
  return (
    <>
      <FacturaDatosFiscalesCard factura={factura} />
      <FacturaConceptosEditor
        facturaId={factura.id}
        organizationId={factura.organization_id}
        moneda={factura.moneda}
        conceptos={conceptosVivos}
      />
    </>
  );
}

