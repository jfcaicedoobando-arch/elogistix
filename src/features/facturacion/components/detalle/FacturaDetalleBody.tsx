/**
 * FacturaDetalleBody — bloques intermedios de la vista de factura.
 * v13.308.16: nuevo orden por importancia (Receptor → operativo → fiscal
 * → conceptos+totales → cobros → NC → bitácora). Emisor y Totales
 * dejaron de ser cards independientes (viven dentro de Timbrado fiscal
 * y Desglose de conceptos respectivamente).
 */
import { FacturaResumenCard } from "@/features/facturacion/components/detalle/FacturaResumenCard";
import { FacturaReceptorCard } from "@/features/facturacion/components/detalle/FacturaReceptorCard";
import { FacturaTimbradoCard } from "@/features/facturacion/components/detalle/FacturaTimbradoCard";
import { FacturaConceptosTable } from "@/features/facturacion/components/detalle/FacturaConceptosTable";
import { FacturaPagosSection } from "@/features/facturacion/components/detalle/FacturaPagosSection";
import { FacturaBitacoraCard } from "@/features/facturacion/components/detalle/FacturaBitacoraCard";
import { FacturaNotasCreditoSeccion } from "@/features/facturacion/components/detalle/FacturaNotasCreditoSeccion";
import { FacturaDetalleEditableSections } from "@/features/facturacion/components/detalle/FacturaDetalleEditableSections";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";
import type { useConceptosFactura } from "@/features/facturacion/hooks/useConceptosFactura";

type ConceptosVivos = NonNullable<ReturnType<typeof useConceptosFactura>["data"]>;

interface FacturaDetalleBodyProps {
  factura: FacturaDetalle;
  canEdit: boolean;
  puedeEditarBorrador: boolean;
  conceptosVivos: ConceptosVivos;
  onRegistrarPago: () => void;
}

export function FacturaDetalleBody(props: FacturaDetalleBodyProps) {
  const { factura, canEdit, puedeEditarBorrador, conceptosVivos, onRegistrarPago } = props;
  const mostrarReceptor = !!factura.cliente_id;
  const mostrarTimbrado = !!factura.uuid_fiscal;
  const mostrarConceptos = !puedeEditarBorrador;

  return (
    <>
      {mostrarReceptor && (
        <FacturaReceptorCard
          clienteId={factura.cliente_id}
          clienteNombre={factura.cliente_nombre}
          rfcFactura={factura.rfc_cliente}
        />
      )}

      <FacturaResumenCard factura={factura} />

      {mostrarTimbrado && factura.uuid_fiscal && (
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

      <FacturaDetalleEditableSections
        factura={factura}
        canEdit={canEdit}
        puedeEditarBorrador={puedeEditarBorrador}
        conceptosVivos={conceptosVivos}
      />

      {mostrarConceptos && (
        <FacturaConceptosTable
          snapshot={factura.snapshot_emision}
          moneda={factura.moneda}
          conceptos={conceptosVivos}
          subtotal={Number(factura.subtotal)}
          iva={Number(factura.iva)}
          total={Number(factura.total)}
        />
      )}

      <FacturaPagosSection
        facturaId={factura.id}
        facturaNumero={factura.numero}
        totalFactura={Number(factura.total)}
        moneda={factura.moneda}
        estadoFactura={factura.estado}
        canEdit={canEdit}
        onRegistrarPago={onRegistrarPago}
      />
      <FacturaNotasCreditoSeccion
        facturaId={factura.id}
        facturaNumero={factura.numero}
        monedaFactura={factura.moneda}
        tipoCambioFactura={Number(factura.tipo_cambio ?? 1)}
        saldoFactura={Number(factura.total)}
        uuidFacturaOriginal={factura.uuid_fiscal ?? null}
        snapshotEmision={factura.snapshot_emision}
        canEdit={canEdit}
      />
      <FacturaBitacoraCard facturaId={factura.id} />
    </>
  );
}
