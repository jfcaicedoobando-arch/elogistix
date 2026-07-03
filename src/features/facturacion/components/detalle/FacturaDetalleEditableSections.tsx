/**
 * Secciones editables del detalle de factura: alerta fiscal, botón de
 * sustitución de CFDI, formulario de datos fiscales y editor de conceptos.
 * Extraído de FacturaDetalle para reducir la complejidad ciclomática del
 * componente contenedor (Power-of-10 #4/#7).
 */
import { Replace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FacturaFiscalCheckAlert } from "./FacturaFiscalCheckAlert";
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
      {factura.cliente_id && (
        <FacturaFiscalCheckAlert clienteId={factura.cliente_id} estado={factura.estado} />
      )}

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
