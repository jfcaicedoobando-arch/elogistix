import { Link } from "react-router-dom";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { DetailHeader } from "@/components/shared/DetailHeader";

import { toTitleCase } from "@/lib/formatters";
import { EmbarqueStatusChip } from "./EmbarqueStatusChip";
import { EmbarqueBadgeAdmin } from "./EmbarqueBadgeAdmin";
import { EmbarqueHeaderDialogs } from "./EmbarqueHeaderDialogs";
import { EmbarqueDetalleHeaderActions } from "./EmbarqueDetalleHeaderActions";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useCotizacionFolio } from "@/features/cotizacion/hooks";
import { useEmbarqueEstadoActions } from "@/features/embarques/hooks/useEmbarqueEstadoActions";
import type { EmbarqueRow } from "@/features/embarques/hooks";
import { EstadoDivergenteHint } from "./header/EstadoDivergenteHint";

/**
 * v13.309.50 · PR-S2-B: el header ahora consume internamente
 * `useEmbarqueEstadoActions` (patrón `useEmbarqueDetalleTabsData`), lo que
 * reduce la superficie del componente de 33 → 10 props. La ruta sólo pasa
 * el embarque, el estado visual, los callbacks de navegación por tab y los
 * disparadores de diálogos globales (eliminar/duplicar/compartir tracking).
 */
interface Props {
  embarque: EmbarqueRow;
  embarqueId: string;
  estadoVisual: string;
  siguienteEstado: string | null;
  canEdit: boolean;
  trackingPending: boolean;
  onCompartirTracking: () => void;
  onAbrirEliminar: () => void;
  onAbrirDuplicar: () => void;
  onNavigateTab: (tab: "documentos" | "tracking" | "cierre") => void;
}


export function EmbarqueDetalleHeader({
  embarque, embarqueId, estadoVisual, siguienteEstado, canEdit,
  trackingPending, onCompartirTracking, onAbrirEliminar, onAbrirDuplicar,
  onNavigateTab,
}: Props) {

  const { isAdmin } = usePermissions();
  const puedeReabrir = isAdmin && estadoVisual === "Cerrado";
  const { data: cotizacionFolio } = useCotizacionFolio(embarque.cotizacion_id);

  const {
    handleAvanzarEstado,
    handleReabrir, reabrirEmbarque,
    handleCancelar, tieneDeudaPendiente,
    warnCierreOpen, setWarnCierreOpen, confirmarCierreSinProforma, conceptosSinProforma,
    docsFaltantes, docsBloqueantes,
    warnDocsOpen, setWarnDocsOpen, blockDocsOpen, setBlockDocsOpen,
    blockFechaLlegadaOpen, setBlockFechaLlegadaOpen,
    confirmarAvanceConDocsPendientes,
    avanzarEstado,
    cierreEsSiguiente, rolPuedeCerrar, cierrePuedeAvanzar, cierreMotivoBloqueo,
  } = useEmbarqueEstadoActions(embarque, embarqueId);

  const bloqueadoPorDocs = docsBloqueantes && docsFaltantes.length > 0;
  const onIrADocumentos = () => { setBlockDocsOpen(false); onNavigateTab("documentos"); };
  const onIrATracking = () => { setBlockFechaLlegadaOpen(false); onNavigateTab("tracking"); };
  const onIrACierre = () => onNavigateTab("cierre");

  return (
    <>
      <DetailHeader
        backTo="/embarques"
        backLabel="Volver a Embarques"
        title={labelExpediente(embarque.expediente, embarque.id)}
        badge={
          <>
            <EmbarqueStatusChip
              estado={estadoVisual}
              modo={embarque.modo}
              tieneProforma={embarque.tiene_proforma}
              cobroStatus={embarque.cobro_cliente_status as "pendiente" | "parcial" | "pagado" | null | undefined}
            />
            <EmbarqueBadgeAdmin embarqueId={embarqueId} estado={estadoVisual} onIrACierre={onIrACierre} />
            <EstadoDivergenteHint estadoVisual={estadoVisual} estadoGuardado={embarque.estado} />
          </>
        }
        subtitle={
          <>
            <span>{toTitleCase(embarque.cliente_nombre)}</span>
            <span aria-hidden className="mx-1.5 opacity-60">·</span>
            {embarque.cotizacion_id ? (
              cotizacionFolio ? (
                <Link
                  to={`/cotizaciones/${embarque.cotizacion_id}`}
                  className="text-xs hover:text-foreground hover:underline"
                >
                  Cotización origen: {cotizacionFolio}
                </Link>
              ) : (
                <span className="text-xs">Cotización origen no disponible</span>
              )
            ) : (
              <span className="text-xs text-warning" title="Embarque legacy sin cotización vinculada (creado antes de la política tarifa-first)">
                Sin cotización vinculada
              </span>
            )}
          </>
        }
        trailing={
          <EmbarqueDetalleHeaderActions
        expediente={labelExpediente(embarque.expediente, embarque.id)}
        estadoVisual={estadoVisual}
        siguienteEstado={siguienteEstado}
        canEdit={canEdit}
        avanzandoEstado={avanzarEstado.isPending}
        trackingPending={trackingPending}
        embarqueId={embarqueId}
        puedeReabrir={puedeReabrir}
        reabriendoEstado={reabrirEmbarque.isPending}
        docsFaltantes={docsFaltantes}
        bloqueadoPorDocs={bloqueadoPorDocs}
        onAvanzarEstado={handleAvanzarEstado}
        onCompartirTracking={onCompartirTracking}
        onAbrirEliminar={onAbrirEliminar}
        onAbrirDuplicar={onAbrirDuplicar}
        onReabrir={handleReabrir}
        cierreEsSiguiente={cierreEsSiguiente}
        rolPuedeCerrar={rolPuedeCerrar}
        cierrePuedeAvanzar={cierrePuedeAvanzar}
        cierreMotivoBloqueo={cierreMotivoBloqueo}
        onIrACierre={onIrACierre}
        onIrADocumentos={onIrADocumentos}
        onCancelar={handleCancelar}
        cancelandoEmbarque={avanzarEstado.isPending}
        tieneDeudaPendiente={tieneDeudaPendiente}
          />
        }
      />

      <EmbarqueHeaderDialogs
        siguienteEstado={siguienteEstado}
        warnCierreOpen={warnCierreOpen}
        onWarnCierreOpenChange={setWarnCierreOpen}
        onConfirmarCierreSinProforma={confirmarCierreSinProforma}
        conceptosSinProforma={conceptosSinProforma}
        docsFaltantes={docsFaltantes}
        warnDocsOpen={warnDocsOpen}
        onWarnDocsOpenChange={setWarnDocsOpen}
        blockDocsOpen={blockDocsOpen}
        onBlockDocsOpenChange={setBlockDocsOpen}
        onConfirmarAvanceConDocsPendientes={confirmarAvanceConDocsPendientes}
        onIrADocumentos={onIrADocumentos}
        blockFechaLlegadaOpen={blockFechaLlegadaOpen}
        onBlockFechaLlegadaOpenChange={setBlockFechaLlegadaOpen}
        onIrATracking={onIrATracking}
      />

    </>
  );
}
