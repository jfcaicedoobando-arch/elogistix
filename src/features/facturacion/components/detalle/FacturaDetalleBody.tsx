/** FacturaDetalleBody — bloques intermedios de la vista de factura. */
import { FacturaResumenCard } from "@/features/facturacion/components/detalle/FacturaResumenCard";
import { FacturaEmisorCard } from "@/features/facturacion/components/detalle/FacturaEmisorCard";
import { FacturaReceptorCard } from "@/features/facturacion/components/detalle/FacturaReceptorCard";
import { FacturaTotalesCard } from "@/features/facturacion/components/detalle/FacturaTotalesCard";
import { FacturaTimbradoCard } from "@/features/facturacion/components/detalle/FacturaTimbradoCard";
import { FacturaConceptosTable } from "@/features/facturacion/components/detalle/FacturaConceptosTable";
import { FacturaPagosSection } from "@/features/facturacion/components/detalle/FacturaPagosSection";
import { FacturaBitacoraCard } from "@/features/facturacion/components/detalle/FacturaBitacoraCard";
import { FacturaNotasCreditoSeccion } from "@/features/facturacion/components/detalle/FacturaNotasCreditoSeccion";
import { FacturaDetalleEditableSections } from "@/features/facturacion/components/detalle/FacturaDetalleEditableSections";

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FacturaDetalleBodyProps {
  factura: any;
  canEdit: boolean;
  puedeEditarBorrador: boolean;
  conceptosVivos: any;
  onRegistrarPago: () => void;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function FacturaDetalleBody(props: FacturaDetalleBodyProps) {
  const { factura, canEdit, puedeEditarBorrador, conceptosVivos, onRegistrarPago } = props;
  const mostrarReceptor = !!factura.cliente_id;
  const mostrarTimbrado = !!factura.uuid_fiscal;
  const mostrarConceptos = !puedeEditarBorrador;

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <FacturaEmisorCard />
        {mostrarReceptor && (
          <FacturaReceptorCard
            clienteId={factura.cliente_id}
            clienteNombre={factura.cliente_nombre}
            rfcFactura={factura.rfc_cliente}
          />
        )}
      </div>

      <FacturaResumenCard factura={factura} />

      {mostrarTimbrado && (
        <FacturaTimbradoCard
          uuidFiscal={factura.uuid_fiscal}
          folioFiscal={factura.folio_fiscal}
          serie={factura.serie}
          fechaEmision={factura.fecha_emision}
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
        />
      )}

      <FacturaTotalesCard
        subtotal={Number(factura.subtotal)}
        iva={Number(factura.iva)}
        total={Number(factura.total)}
        moneda={factura.moneda}
      />

      <FacturaPagosSection
        facturaId={factura.id}
        facturaNumero={factura.numero}
        totalFactura={Number(factura.total)}
        moneda={factura.moneda}
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
