/**
 * Pestañas del detalle de factura de proveedor: reutiliza las secciones ya
 * existentes, repartidas por tema (estilo Odoo).
 * v13.350.0: nombres, orden y contadores en espejo con facturas emitidas
 * (Conceptos · Proveedor y datos fiscales · Pagos · Notas de crédito · Documentos).
 */
import { useState } from "react";
import { DocumentoTabs, type DocumentoTabItem } from "@/components/shared/documento/DocumentoTabs";
import { DialogEditarPagoProveedor } from "@/features/cxp/components/DialogEditarPagoProveedor";
import type { PagoEditable } from "@/features/cxp/hooks/usePagoProveedorForm";
import { InfoFacturaSection } from "@/features/cxp/components/InfoFacturaSection";
import { ConceptosFacturaSection } from "@/features/cxp/components/ConceptosFacturaSection";
import { NotasCreditoSection } from "@/features/cxp/components/NotasCreditoSection";
import { DocumentosProveedorSection } from "@/features/cxp/components/detalle/DocumentosProveedorSection";
import { BitacoraTesoreriaSection } from "@/features/cxp/components/BitacoraTesoreriaSection";
import { ConciliacionTesoreriaSection } from "@/features/cxp/components/ConciliacionTesoreriaSection";
import { AnticiposAplicadosSection } from "@/features/anticipos-proveedor/components/AnticiposAplicadosSection";
import { AnticipoDisponibleAviso } from "@/features/anticipos-proveedor/components/AnticipoDisponibleAviso";
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
  const [pagoEditar, setPagoEditar] = useState<PagoEditable | null>(null);
  const { data: conceptos = [] } = useConceptosCfdiFactura(f.id);
  const { data: notasCredito = [] } = useNotasCreditoFactura(f.id);

  const tabs: DocumentoTabItem[] = [
    {
      id: "conceptos",
      label: "Conceptos",
      count: conceptos.length,
      content: (
        <ConceptosFacturaSection
          facturaId={f.id}
          moneda={f.moneda}
          retenciones={f.retenciones}
          total={f.total}
          edicion={canEdit ? {
            folio: f.folio_proveedor || f.folio_interno,
            subtotal: f.subtotal,
            uuidFiscal: f.uuid_fiscal,
            archivoXmlUrl: f.archivo_xml_url,
            estado: f.estado,
            pagado: f.pagado,
          } : undefined}
        />
      ),
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
            onEditarPago={canEdit ? (p) => setPagoEditar(aPagoEditable(p)) : undefined}
          />
          <AnticipoDisponibleAviso
            proveedorId={f.proveedor_id}
            facturaId={f.id}
            folioFactura={f.folio_proveedor || f.folio_interno}
            importes={{
              subtotal: f.subtotal,
              iva: f.iva,
              ieps: f.ieps,
              retenciones: f.retenciones,
              total: f.total,
              pagado: f.pagado,
              notasCredito: f.notas_credito,
              saldo: f.saldo,
              moneda: f.moneda,
            }}
            canEdit={canEdit}
            facturaEmbarqueId={f.embarque_id}
            facturaExpediente={f.embarque_expediente}
          />

          <AnticiposAplicadosSection facturaId={f.id} />
          <ConciliacionTesoreriaSection facturaId={f.id} monedaFactura={f.moneda} />
          <BitacoraTesoreriaSection
            facturaId={f.id}
            monedaFactura={f.moneda}
            folio={f.folio_proveedor || f.folio_interno}
            proveedor={f.proveedor_nombre}
          />
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

  return (
    <>
      <DocumentoTabs tabs={tabs} />
      <DialogEditarPagoProveedor
        open={pagoEditar !== null}
        onOpenChange={(o) => !o && setPagoEditar(null)}
        factura={f}
        pago={pagoEditar}
      />
    </>
  );
}

/** Normaliza la fila de la tabla al contrato del formulario de edición. */
function aPagoEditable(p: PagoRow): PagoEditable {
  return {
    id: p.id,
    fecha_pago: p.fecha_pago,
    monto: Number(p.monto),
    moneda: p.moneda as PagoEditable["moneda"],
    tipo_cambio_usd: p.tipo_cambio_usd != null ? Number(p.tipo_cambio_usd) : null,
    metodo_pago: p.metodo_pago,
    referencia: p.referencia ?? null,
    notas: p.notas ?? null,
    cuenta_bancaria_id: p.cuenta_bancaria_id ?? null,
    diferencia_cambiaria_mxn:
      p.diferencia_cambiaria_mxn != null ? Number(p.diferencia_cambiaria_mxn) : null,
    updated_at: p.updated_at ?? null,
  };
}
