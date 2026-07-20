/** FacturaDetalleView — vista pura de la factura ya resuelta. */
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/PageContainer";
import { FacturaDetalleFooterDialogs } from "@/features/facturacion/components/detalle/FacturaDetalleFooterDialogs";
import { FacturaDetalleActionsBar } from "@/features/facturacion/components/detalle/FacturaDetalleActionsBar";
import { FacturaDetalleHeader } from "@/features/facturacion/components/detalle/FacturaDetalleHeader";
import { FacturaDetalleModales } from "@/features/facturacion/components/detalle/FacturaDetalleModales";
import { FacturaDetalleBody } from "@/features/facturacion/components/detalle/FacturaDetalleBody";
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

      <FacturaDetalleBody
        factura={factura}
        canEdit={canEdit}
        puedeEditarBorrador={puedeEditarBorrador}
        conceptosVivos={conceptosVivos}
        onRegistrarPago={() => setPagoOpen(true)}
      />


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
