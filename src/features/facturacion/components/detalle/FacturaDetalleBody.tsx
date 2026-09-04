/**
 * FacturaDetalleBody — cuerpo de la factura emitida.
 * v13.350.0: pestañas en espejo con facturas recibidas — Conceptos ·
 * Cliente y datos fiscales · Cobros · Notas de crédito · Documentos.
 */
import { FacturaResumenCard } from "@/features/facturacion/components/detalle/FacturaResumenCard";
import { FacturaReceptorCard } from "@/features/facturacion/components/detalle/FacturaReceptorCard";
import { FacturaTimbradoCard } from "@/features/facturacion/components/detalle/FacturaTimbradoCard";
import { FacturaConceptosTable } from "@/features/facturacion/components/detalle/FacturaConceptosTable";
import { FacturaPagosSection } from "@/features/facturacion/components/detalle/FacturaPagosSection";

import { FacturaNotasCreditoSeccion } from "@/features/facturacion/components/detalle/FacturaNotasCreditoSeccion";
import { FacturaDocumentosSection } from "@/features/facturacion/components/detalle/FacturaDocumentosSection";
import { FacturaDetalleEditableSections } from "@/features/facturacion/components/detalle/FacturaDetalleEditableSections";
import { usePagosFactura } from "@/features/facturacion/hooks";
import { useNotasCreditoDeFactura } from "@/features/facturacion/hooks/useNotasCreditoDeFactura";

import { DocumentoTabs, type DocumentoTabItem } from "@/components/shared/documento/DocumentoTabs";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";
import type { useConceptosFactura } from "@/features/facturacion/hooks/useConceptosFactura";

type ConceptosVivos = NonNullable<ReturnType<typeof useConceptosFactura>["data"]>;

interface FacturaDetalleBodyProps {
  factura: FacturaDetalle;
  canEdit: boolean;
  puedeEditarBorrador: boolean;
  conceptosVivos: ConceptosVivos;
  onRegistrarPago: () => void;
  saldo?: number;
  estaCancelada?: boolean;
  canEnviarRecordatorio?: boolean;
  onEnviarRecordatorio?: () => void;
  /** P1: falló la lectura de pagos o NC aplicadas (saldo no confiable). */
  saldoError?: boolean;
}

export function FacturaDetalleBody(props: FacturaDetalleBodyProps) {
  const { factura, canEdit, puedeEditarBorrador, conceptosVivos, onRegistrarPago } = props;
  const { data: pagos = [] } = usePagosFactura(factura.id);
  const { data: notasCredito = [] } = useNotasCreditoDeFactura(factura.id);

  const tabs: DocumentoTabItem[] = [
    {
      id: "conceptos",
      label: "Conceptos",
      count: conceptosVivos.length,
      content: (
        <>
          <FacturaDetalleEditableSections
            factura={factura}
            canEdit={canEdit}
            puedeEditarBorrador={puedeEditarBorrador}
            conceptosVivos={conceptosVivos}
          />
          {!puedeEditarBorrador && (
            <FacturaConceptosTable
              snapshot={factura.snapshot_emision}
              moneda={factura.moneda}
              conceptos={conceptosVivos}
              subtotal={Number(factura.subtotal)}
              iva={Number(factura.iva)}
              total={Number(factura.total)}
            />
          )}
        </>
      ),
    },
    {
      id: "fiscal",
      label: "Cliente y datos fiscales",
      content: (
        <>
          {!!factura.cliente_id && (
            <FacturaReceptorCard
              clienteId={factura.cliente_id}
              clienteNombre={factura.cliente_nombre}
              rfcFactura={factura.rfc_cliente}
            />
          )}
          <FacturaResumenCard
            factura={factura}
            saldo={props.saldo}
            estaCancelada={props.estaCancelada}
            canEnviarRecordatorio={props.canEnviarRecordatorio}
            onEnviarRecordatorio={props.onEnviarRecordatorio}
          />
          {factura.uuid_fiscal && (
            <FacturaTimbradoCard
              uuidFiscal={factura.uuid_fiscal}
              folioFiscal={factura.folio_fiscal}
              serie={factura.serie}
              usoCfdi={factura.uso_cfdi}
              formaPago={factura.forma_pago}
              metodoPago={factura.metodo_pago}
              ambiente={factura.ambiente}
            />
          )}
        </>
      ),
    },
    {
      id: "cobros",
      label: "Cobros",
      count: pagos.length,
      content: (
        <FacturaPagosSection
          facturaId={factura.id}
          facturaNumero={factura.numero}
          totalFactura={Number(factura.total)}
          moneda={factura.moneda}
          estadoFactura={factura.estado}
          canEdit={canEdit}
          onRegistrarPago={onRegistrarPago}
        />
      ),
    },
    {
      id: "notas-credito",
      label: "Notas de crédito",
      count: notasCredito.length,
      content: (
        <FacturaNotasCreditoSeccion
          facturaId={factura.id}
          facturaNumero={factura.numero}
          fechaFactura={factura.fecha_emision}
          monedaFactura={factura.moneda}
          tipoCambioFactura={Number(factura.tipo_cambio ?? 1)}
          saldoFactura={Number(props.saldo ?? factura.total)}
          saldoError={props.saldoError}
          uuidFacturaOriginal={factura.uuid_fiscal ?? null}
          snapshotEmision={factura.snapshot_emision}
          canEdit={canEdit}
        />
      ),
    },
    {
      id: "documentos",
      label: "Documentos",
      content: <FacturaDocumentosSection factura={factura} />,
    },
  ];

  return <DocumentoTabs tabs={tabs} />;
}

