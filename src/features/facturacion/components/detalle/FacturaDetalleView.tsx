/** FacturaDetalleView — vista pura de la factura ya resuelta. */
import { esFacturaVigenteParaOperar } from "../../domain/facturaVigencia";
import { PageContainer } from "@/components/shared/PageContainer";
import { FacturaDetalleFooterDialogs } from "@/features/facturacion/components/detalle/FacturaDetalleFooterDialogs";
import { FacturaDetalleActionsBar } from "@/features/facturacion/components/detalle/FacturaDetalleActionsBar";
import { FacturaDetalleHeader } from "@/features/facturacion/components/detalle/FacturaDetalleHeader";
import { FacturaDetalleModales } from "@/features/facturacion/components/detalle/FacturaDetalleModales";
import { FacturaDetalleBody } from "@/features/facturacion/components/detalle/FacturaDetalleBody";
import { FacturaDetalleBanners } from "@/features/facturacion/components/detalle/FacturaDetalleBanners";
import { DocumentoDetalleShell } from "@/components/shared/documento/DocumentoDetalleShell";
import { RefacturacionTrazabilidadSection } from "@/features/facturacion/components/refacturacion/RefacturacionTrazabilidadSection";
import { FacturaBitacoraCard } from "@/features/facturacion/components/detalle/FacturaBitacoraCard";

import { calcularDiasVencidoFactura } from "@/features/facturacion/domain/facturaAging";
import { buildKpisFactura } from "@/features/facturacion/domain/facturaKpis";
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
  puedeEmitir: boolean;
  flags: FacturaFlags;
  acuse: AcuseState;
  eliminando: boolean;
  conceptosVivos: ConceptosVivos;
  pagoRepPendiente: PagoRep | undefined;
  timbrarRep: TimbrarRepMutation;
  handleDownload: DescargarCfdiHandler;
  onEliminar: () => void;
  volverHref: string | (() => void);
  volverLabel: string;
  dialogs: DialogsBundle;
  saldo?: number;
  totalPagado?: number;
  /** P1: falló la lectura de pagos o notas de crédito (saldo no confiable). */
  saldoError?: boolean;
  onRetrySaldo?: () => void;
}

export function FacturaDetalleView(props: FacturaDetalleViewProps) {
  const {
    factura, canEdit, puedeEmitir, flags, acuse, eliminando, conceptosVivos,
    pagoRepPendiente, timbrarRep, handleDownload, onEliminar,
    volverHref, volverLabel, dialogs,
  } = props;
  const { sinTimbrar, puedeEditarBorrador, puedeEliminarBorrador } = flags;
  const {
    pagoOpen, setPagoOpen, timbrarOpen, setTimbrarOpen,
    enviarOpen, setEnviarOpen, sustituirOpen, setSustituirOpen,
    refacturarOpen, setRefacturarOpen,
    cancelarOpen, setCancelarOpen, eliminarOpen, setEliminarOpen,
    consultarOpen, setConsultarOpen,
    recordatorioOpen, setRecordatorioOpen,
  } = dialogs;
  const saldoFactura = Number(props.saldo ?? 0);
  const vigente = esFacturaVigenteParaOperar(factura);

  const acuseCancelacionStatus = factura.acuse_cancelacion_status ?? null;
  const cancellationStatus = factura.cancellation_status ?? null;
  const handleTimbrarRep = () => {
    if (vigente && canEdit && pagoRepPendiente) timbrarRep.mutate(pagoRepPendiente.id);
  };

  return (
    <PageContainer>
      <DocumentoDetalleShell
        kpis={buildKpisFactura(factura, props.saldo, props.totalPagado)}
        header={
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
            clienteNombre={factura.cliente_nombre}
            fechaEmision={factura.fecha_emision}
            ambiente={factura.ambiente}
            actions={
              <FacturaDetalleActionsBar
                factura={factura}
                canEdit={canEdit && vigente}
                puedeEmitir={puedeEmitir && vigente}
                flags={flags}
                acuse={acuse}
                eliminando={eliminando}
                puedeEliminarBorrador={puedeEliminarBorrador}
                timbrarRepPending={timbrarRep.isPending}
                onTimbrar={() => { if (vigente) setTimbrarOpen(true); }}
                onEnviarEmail={() => { if (vigente) setEnviarOpen(true); }}
                onRegistrarPago={() => { if (vigente) setPagoOpen(true); }}
                onTimbrarRep={handleTimbrarRep}
                onSustituir={() => { if (vigente) setSustituirOpen(true); }}
                onRefacturar={() => { if (vigente) setRefacturarOpen(true); }}
                onCancelar={() => { if (vigente) setCancelarOpen(true); }}
                onEliminar={() => { if (vigente) setEliminarOpen(true); }}
                onConsultar={() => { if (vigente) setConsultarOpen(true); }}
                onDownload={handleDownload}
              />
            }
          />
        }
        banners={
          <FacturaDetalleBanners
            factura={factura}
            saldoError={props.saldoError}
            onRetrySaldo={props.onRetrySaldo}
            saldo={saldoFactura}
            totalPagado={props.totalPagado}
          />
        }
        rail={<FacturaBitacoraCard facturaId={factura.id} />}
      >
        <FacturaDetalleBody
          factura={factura}
          canEdit={canEdit && vigente}
          puedeEditarBorrador={puedeEditarBorrador}
          conceptosVivos={conceptosVivos}
          onRegistrarPago={() => { if (vigente) setPagoOpen(true); }}
          saldo={saldoFactura}
          saldoError={props.saldoError}
          estaCancelada={flags.estaCancelada}
          canEnviarRecordatorio={canEdit && vigente}
          onEnviarRecordatorio={() => { if (vigente) setRecordatorioOpen(true); }}
        />
        <RefacturacionTrazabilidadSection facturaId={factura.id} />
      </DocumentoDetalleShell>

      {vigente && <FacturaDetalleModales
        factura={factura}
        pagoOpen={pagoOpen} setPagoOpen={setPagoOpen}
        timbrarOpen={timbrarOpen} setTimbrarOpen={setTimbrarOpen}
        enviarOpen={enviarOpen} setEnviarOpen={setEnviarOpen}
        sustituirOpen={sustituirOpen} setSustituirOpen={setSustituirOpen}
        cancelarOpen={cancelarOpen} setCancelarOpen={setCancelarOpen}
        refacturarOpen={refacturarOpen} setRefacturarOpen={setRefacturarOpen}
      />}

      {vigente && <FacturaDetalleFooterDialogs
        facturaId={factura.id}
        numero={factura.numero}
        eliminarOpen={eliminarOpen}
        setEliminarOpen={setEliminarOpen}
        eliminando={eliminando}
        onEliminar={onEliminar}
        consultarOpen={consultarOpen}
        setConsultarOpen={setConsultarOpen}
        recordatorioOpen={recordatorioOpen}
        setRecordatorioOpen={setRecordatorioOpen}
        recordatorio={{
          factura_id: factura.id,
          numero: factura.numero,
          total: Number(factura.total ?? 0),
          saldo: saldoFactura,
          moneda: factura.moneda,
          dias_vencido: calcularDiasVencidoFactura(factura.fecha_vencimiento) ?? 0,
          fecha_vencimiento: factura.fecha_vencimiento,
          cliente_nombre: factura.cliente_nombre,
        }}
      />}
    </PageContainer>
  );
}

