/**
 * FacturaDetalle — vista admin de una factura individual. Si la URL trae
 * `?accion=timbrar` (llegada desde conversión de proforma) abre el diálogo
 * de timbrado automáticamente.
 */
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailSkeleton } from "@/components/shared/skeletons";
import { PageContainer } from "@/components/shared/PageContainer";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";
import { useRegisterBreadcrumbLabel } from "@/lib/contexts/BreadcrumbContext";
import { useAutoAbrirTimbrar } from "@/features/facturacion/hooks/useAutoAbrirTimbrar";
import { useFacturaDetalleDialogs } from "@/features/facturacion/hooks/useFacturaDetalleDialogs";
import { useFacturaDetalleController } from "@/features/facturacion/hooks/useFacturaDetalleController";
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

export default function FacturaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    canEdit, factura, isLoading, acuse, flags,
    pagoRepPendiente, handleDownload, eliminar, eliminando,
    conceptosVivos, timbrarRep,
  } = useFacturaDetalleController(id);
  useRegisterBreadcrumbLabel(id, factura?.numero);
  const {
    pagoOpen, setPagoOpen, timbrarOpen, setTimbrarOpen,
    enviarOpen, setEnviarOpen, sustituirOpen, setSustituirOpen,
    cancelarOpen, setCancelarOpen, eliminarOpen, setEliminarOpen,
  } = useFacturaDetalleDialogs();

  const { sinTimbrar, puedeEditarBorrador, puedeEliminarBorrador, puedeTimbrarDesdeSistema } = flags;
  useAutoAbrirTimbrar(puedeTimbrarDesdeSistema, canEdit, () => setTimbrarOpen(true));

  if (isLoading) {
    return (
      <PageContainer>
        <DetailSkeleton />
      </PageContainer>
    );
  }

  if (!factura) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Factura no encontrada o sin acceso.</p>
        <Button variant="link" onClick={() => navigate("/facturacion")}>
          Volver a facturación
        </Button>
      </div>
    );
  }

  return (
    <PageContainer>
      <Button variant="ghost" size="sm" onClick={() => navigate("/facturacion")} className="-ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> Volver
      </Button>

      <FacturaDetalleHeader
        numero={factura.numero}
        estado={factura.estado}
        sinTimbrar={sinTimbrar}
        clienteNombre={factura.cliente_nombre}
        expediente={factura.expediente}
        total={Number(factura.total)}
        moneda={factura.moneda}
        ambiente={factura.ambiente}
      />

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
        onTimbrarRep={() => {
          if (pagoRepPendiente) timbrarRep.mutate(pagoRepPendiente.id);
        }}
        onSustituir={() => setSustituirOpen(true)}
        onCancelar={() => setCancelarOpen(true)}
        onEliminar={() => setEliminarOpen(true)}
        onDownload={handleDownload}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <FacturaEmisorCard />
        {factura.cliente_id && (
          <FacturaReceptorCard
            clienteId={factura.cliente_id}
            clienteNombre={factura.cliente_nombre}
            rfcFactura={factura.rfc_cliente}
          />
        )}
      </div>

      <FacturaResumenCard factura={factura} />

      {factura.uuid_fiscal && (
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

      {!puedeEditarBorrador && (
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

      <DoubleConfirmDeleteDialog
        open={eliminarOpen}
        onOpenChange={setEliminarOpen}
        entityName={`borrador ${factura.numero}`}
        description="Se eliminará el borrador de factura y la proforma volverá a estar disponible para convertir. Sólo se pueden eliminar borradores sin timbrar."
        finalDescription="Esta acción es irreversible: se borran conceptos, la factura borrador y se revierte la proforma."
        isPending={eliminando}
        onConfirm={() => eliminar(factura.id)}
      />
    </PageContainer>
  );
}
