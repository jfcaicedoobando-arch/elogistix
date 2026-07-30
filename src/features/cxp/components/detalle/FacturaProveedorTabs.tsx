/**
 * Pestañas del detalle de factura de proveedor: reutiliza las secciones ya
 * existentes, repartidas por tema (estilo Odoo).
 * v13.350.0: nombres, orden y contadores en espejo con facturas emitidas
 * (Conceptos · Proveedor y datos fiscales · Pagos · Notas de crédito · Documentos).
 */
import { DocumentoTabs, type DocumentoTabItem } from "@/components/shared/documento/DocumentoTabs";
import { InfoFacturaSection } from "@/features/cxp/components/InfoFacturaSection";
import { ConceptosFacturaSection } from "@/features/cxp/components/ConceptosFacturaSection";
import { NotasCreditoSection } from "@/features/cxp/components/NotasCreditoSection";
import { DocumentosProveedorSection } from "@/features/cxp/components/detalle/DocumentosProveedorSection";
import { AnticiposAplicadosSection } from "@/features/anticipos-proveedor/components/AnticiposAplicadosSection";
import { PagosTable } from "@/features/cxp/components/DialogDetallePagosProveedor.sections";
import { useConceptosCfdiFactura } from "@/features/cxp/hooks/useConceptosCfdiFactura";
import { useNotasCreditoFactura } from "@/features/cxp/hooks/useNotasCreditoProveedor";
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
  const { data: conceptos = [] } = useConceptosCfdiFactura(f.id);
  const { data: notasCredito = [] } = useNotasCreditoFactura(f.id);

  const tabs: DocumentoTabItem[] = [
    {
      id: "conceptos",
      label: "Conceptos",
      count: conceptos.length,
      content: <ConceptosFacturaSection facturaId={f.id} moneda={f.moneda} />,
    },
    {
      id: "fiscal",
      label: "Proveedor y datos fiscales",
      content: <InfoFacturaSection factura={f} canEdit={canEdit} />,
    },
    {
      id: "pagos",
      label: "Pagos",
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
      count: notasCredito.length,
      content: (
        <NotasCreditoSection
          facturaId={f.id}
          monedaFactura={f.moneda}
          saldoFactura={f.saldo}
          canEdit={canEdit}
        />
      ),
    },
    {
      id: "documentos",
      label: "Documentos",
      content: <DocumentosProveedorSection factura={f} canEdit={canEdit} />,
    },
  ];

  return <DocumentoTabs tabs={tabs} />;
}
