/** FacturaDetalleView — vista pura de la factura ya resuelta. */
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { FacturaDetalleFooterDialogs } from "@/features/facturacion/components/detalle/FacturaDetalleFooterDialogs";
import { FacturaResumenCard } from "@/features/facturacion/components/detalle/FacturaResumenCard";
import { FacturaEmisorCard } from "@/features/facturacion/components/detalle/FacturaEmisorCard";
import { FacturaReceptorCard } from "@/features/facturacion/components/detalle/FacturaReceptorCard";
import { FacturaTotalesCard } from "@/features/facturacion/components/detalle/FacturaTotalesCard";
import { FacturaTimbradoCard } from "@/features/facturacion/components/detalle/FacturaTimbradoCard";
import { FacturaConceptosTable } from "@/features/facturacion/components/detalle/FacturaConceptosTable";
import { FacturaPagosSection } from "@/features/facturacion/components/detalle/FacturaPagosSection";
import { FacturaBitacoraCard } from "@/features/facturacion/components/detalle/FacturaBitacoraCard";
import { FacturaDetalleActionsBar } from "@/features/facturacion/components/detalle/FacturaDetalleActionsBar";
import { FacturaNotasCreditoSeccion } from "@/features/facturacion/components/detalle/FacturaNotasCreditoSeccion";
import { FacturaDetalleHeader } from "@/features/facturacion/components/detalle/FacturaDetalleHeader";
import { FacturaDetalleModales } from "@/features/facturacion/components/detalle/FacturaDetalleModales";
import { FacturaDetalleEditableSections } from "@/features/facturacion/components/detalle/FacturaDetalleEditableSections";
import { SustitutaCanceladaBanner } from "@/features/facturacion/components/detalle/SustitutaCanceladaBanner";
import { ClaimPendingBanner } from "@/features/facturacion/components/detalle/ClaimPendingBanner";


/* eslint-disable @typescript-eslint/no-explicit-any */
// Tipos amplios: la ruta ya validó que factura no es null y agrupa hooks/dialogs.
type FacturaAny = any;

interface FacturaDetalleViewProps {
  factura: FacturaAny;
  canEdit: boolean;
  flags: any;
  acuse: any;
  eliminando: boolean;
  conceptosVivos: any;
  pagoRepPendiente: any;
  timbrarRep: any;
  handleDownload: any;
  onEliminar: () => void;
  volverHref: string;
  volverLabel: string;
  onVolver: (href: string) => void;
  dialogs: any;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export function FacturaDetalleView(props: FacturaDetalleViewProps) {
  const {
    factura, canEdit, flags, acuse, eliminando, conceptosVivos,
    pagoRepPendiente, timbrarRep, handleDownload, onEliminar,
    volverHref, volverLabel, onVolver, dialogs,
  } = props;
  const { sinTimbrar, puedeEditarBorrador, puedeEliminarBorrador } = flags;
  const {
    pagoOpen, setPagoOpen, timbrarOpen, setTimbrarOpen,
    enviarOpen, setEnviarOpen, sustituirOpen, setSustituirOpen,
    cancelarOpen, setCancelarOpen, eliminarOpen, setEliminarOpen,
    consultarOpen, setConsultarOpen,
  } = dialogs;

  const acuseCancelacionStatus = factura.acuse_cancelacion_status ?? null;
  const cancellationStatus = factura.cancellation_status ?? null;
  const mostrarSustitutaCancelada =
    !!factura.sustituida_por && factura.sustituida_por_ref?.estado === "Cancelada";
  const mostrarReceptor = !!factura.cliente_id;
  const mostrarTimbrado = !!factura.uuid_fiscal;
  const mostrarConceptos = !puedeEditarBorrador;
  const handleTimbrarRep = () => {
    if (pagoRepPendiente) timbrarRep.mutate(pagoRepPendiente.id);
  };

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => onVolver(volverHref)} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> {volverLabel}
      </Button>

      <FacturaDetalleHeader
        numero={factura.numero}
        estado={factura.estado}
        acuseCancelacionStatus={acuseCancelacionStatus}
        cancellationStatus={cancellationStatus}
        sinTimbrar={sinTimbrar}
        clienteNombre={factura.cliente_nombre}
        expediente={factura.expediente}
        total={Number(factura.total)}
        moneda={factura.moneda}
        ambiente={factura.ambiente}
      />

      <ClaimPendingBanner
        facturaId={factura.id}
        facturapiId={factura.facturapi_id ?? null}
        facturapiClaimAt={factura.facturapi_claim_at ?? null}
      />

      {mostrarSustitutaCancelada && (
        <SustitutaCanceladaBanner
          sustitutaId={factura.sustituida_por}
          sustitutaNumero={factura.sustituida_por_ref?.numero ?? null}
        />
      )}


      <FacturaDetalleActionsBar
        factura={factura}
        canEdit={canEdit}
        flags={flags}
        acuse={acuse}
        eliminando={eliminando}
        puedeEliminarBorrador={puedeEliminarBorrador}
        timbrarRepPending={timbrarRep.isPending}
        onTimbrar={() => setTimbrarOpen(true)}
        onEnviarEmail={() => setEnviarOpen(true)}
        onRegistrarPago={() => setPagoOpen(true)}
        onTimbrarRep={handleTimbrarRep}
        onSustituir={() => setSustituirOpen(true)}
        onCancelar={() => setCancelarOpen(true)}
        onEliminar={() => setEliminarOpen(true)}
        onConsultar={() => setConsultarOpen(true)}
        onDownload={handleDownload}
      />

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
        onRegistrarPago={() => setPagoOpen(true)}
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

      <FacturaDetalleModales
        factura={factura}
        pagoOpen={pagoOpen} setPagoOpen={setPagoOpen}
        timbrarOpen={timbrarOpen} setTimbrarOpen={setTimbrarOpen}
        enviarOpen={enviarOpen} setEnviarOpen={setEnviarOpen}
        sustituirOpen={sustituirOpen} setSustituirOpen={setSustituirOpen}
        cancelarOpen={cancelarOpen} setCancelarOpen={setCancelarOpen}
      />

      <FacturaDetalleFooterDialogs
        facturaId={factura.id}
        numero={factura.numero}
        eliminarOpen={eliminarOpen}
        setEliminarOpen={setEliminarOpen}
        eliminando={eliminando}
        onEliminar={onEliminar}
        consultarOpen={consultarOpen}
        setConsultarOpen={setConsultarOpen}
      />
    </PageContainer>
  );
}
