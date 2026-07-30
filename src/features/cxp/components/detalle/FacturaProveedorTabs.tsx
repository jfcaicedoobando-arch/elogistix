/**
 * Pestañas del detalle de factura de proveedor: reutiliza las secciones ya
 * existentes del modal, repartidas por tema (estilo Odoo).
 */
import { DocumentoTabs, type DocumentoTabItem } from "@/components/shared/documento/DocumentoTabs";
import { InfoFacturaSection } from "@/features/cxp/components/InfoFacturaSection";
import { ConceptosFacturaSection } from "@/features/cxp/components/ConceptosFacturaSection";
import { NotasCreditoSection } from "@/features/cxp/components/NotasCreditoSection";
import { AnticiposAplicadosSection } from "@/features/anticipos-proveedor/components/AnticiposAplicadosSection";
import { PagosTable } from "@/features/cxp/components/DialogDetallePagosProveedor.sections";
type PagoRow = Parameters<typeof PagosTable>[0]["pagos"][number];
import type { FacturaCxP } from "@/features/cxp/services";

interface Props {
  factura: FacturaCxP;
  pagos: PagoRow[];
  pagosLoading: boolean;
  canEdit: boolean;
  onEliminarPago: (id: string) => void;
}

export function FacturaProveedorTabs({
  factura: f, pagos, pagosLoading, canEdit, onEliminarPago,
}: Props) {
  const tabs: DocumentoTabItem[] = [
    {
      id: "conceptos",
      label: "Conceptos",
      content: <ConceptosFacturaSection facturaId={f.id} moneda={f.moneda} />,
    },
    {
      id: "fiscal",
      label: "Proveedor y fiscal",
      content: <InfoFacturaSection factura={f} canEdit={canEdit} />,
    },
    {
      id: "pagos",
      label: "Pagos y anticipos",
      count: pagos.length,
      content: (
        <>
          <PagosTable
            pagos={pagos}
            isLoading={pagosLoading}
            canEdit={canEdit}
            onEliminarPago={onEliminarPago}
          />
          <AnticiposAplicadosSection facturaId={f.id} />
        </>
      ),
    },
    {
      id: "notas-credito",
      label: "Notas de crédito",
      content: (
        <NotasCreditoSection
          facturaId={f.id}
          monedaFactura={f.moneda}
          saldoFactura={f.saldo}
          canEdit={canEdit}
        />
      ),
    },
  ];

  return <DocumentoTabs tabs={tabs} />;
}
