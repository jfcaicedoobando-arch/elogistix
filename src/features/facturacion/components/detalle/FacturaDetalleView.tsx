/** FacturaDetalleView — vista pura de la factura ya resuelta. */
import { PageContainer } from "@/components/shared/PageContainer";
import { FacturaDetalleFooterDialogs } from "@/features/facturacion/components/detalle/FacturaDetalleFooterDialogs";
import { FacturaDetalleActionsBar } from "@/features/facturacion/components/detalle/FacturaDetalleActionsBar";
import { FacturaDetalleHeader } from "@/features/facturacion/components/detalle/FacturaDetalleHeader";
import { FacturaDetalleModales } from "@/features/facturacion/components/detalle/FacturaDetalleModales";
import { FacturaDetalleBody } from "@/features/facturacion/components/detalle/FacturaDetalleBody";
import { SustitutaCanceladaBanner } from "@/features/facturacion/components/detalle/SustitutaCanceladaBanner";
import { ClaimPendingBanner } from "@/features/facturacion/components/detalle/ClaimPendingBanner";
import type { FacturaDetalle } from "@/features/facturacion/services/detail";
import type { FacturaFlags } from "@/features/facturacion/domain/facturaFlags";
import type { useAcuseCancelacion } from "@/features/facturacion/hooks/useAcuseCancelacion";
import type { useTimbrarRep } from "@/features/facturacion/hooks/useTimbrarRep";
import type { useDescargarCfdi } from "@/features/facturacion/hooks/useDescargarCfdi";
import type { useConceptosFactura } from "@/features/facturacion/hooks/useConceptosFactura";
import type { useFacturaDetalleDialogs } from "@/features/facturacion/hooks/useFacturaDetalleDialogs";
import type { usePagosFactura } from "@/features/facturacion/hooks/usePagosFactura";

type AcuseState = ReturnType<typeof useAcuseCancelacion>;
type TimbrarRepMutation = ReturnType<typeof useTimbrarRep>;
type DescargarCfdiHandler = ReturnType<typeof useDescargarCfdi>;
type ConceptosVivos = NonNullable<ReturnType<typeof useConceptosFactura>["data"]>;
type PagosVivos = NonNullable<ReturnType<typeof usePagosFactura>["data"]>;
type PagoRep = PagosVivos[number];
type DialogsBundle = ReturnType<typeof useFacturaDetalleDialogs>;

interface FacturaDetalleViewProps {
  factura: FacturaDetalle;
  canEdit: boolean;
  flags: FacturaFlags;
  acuse: AcuseState;
  eliminando: boolean;
  conceptosVivos: ConceptosVivos;
  pagoRepPendiente: PagoRep | undefined;
  timbrarRep: TimbrarRepMutation;
  handleDownload: DescargarCfdiHandler;
  onEliminar: () => void;
  volverHref: string;
  volverLabel: string;
  dialogs: DialogsBundle;
  saldo?: number;
}

export function FacturaDetalleView(props: FacturaDetalleViewProps) {
  const {
    factura, canEdit, flags, acuse, eliminando, conceptosVivos,
    pagoRepPendiente, timbrarRep, handleDownload, onEliminar,
    volverHref, volverLabel, dialogs,
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
  const handleTimbrarRep = () => {
    if (pagoRepPendiente) timbrarRep.mutate(pagoRepPendiente.id);
  };

  return (
    <PageContainer>
      <FacturaDetalleHeader
        volverHref={volverHref}
        volverLabel={volverLabel}
        numero={factura.numero}
        estado={factura.estado}
        acuseCancelacionStatus={acuseCancelacionStatus}
        cancellationStatus={cancellationStatus}
        sinTimbrar={sinTimbrar}
        expediente={factura.expediente}
        embarqueId={factura.embarque_id}
        proformaId={factura.proforma_id}
        proformaNumero={factura.proformas?.numero ?? null}
        total={Number(factura.total)}
        saldo={props.saldo}
        moneda={factura.moneda}
        ambiente={factura.ambiente}
      />


      <ClaimPendingBanner
        facturaId={factura.id}
        facturapiId={factura.facturapi_id ?? null}
        facturapiClaimAt={factura.facturapi_claim_at ?? null}
      />

      {mostrarSustitutaCancelada && factura.sustituida_por && (
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
