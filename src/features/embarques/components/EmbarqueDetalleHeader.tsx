import { Link } from "react-router-dom";
import { labelExpediente } from "@/lib/domain/labelExpediente";
import { DetailHeader } from "@/components/shared/DetailHeader";
import { useVolver } from "@/hooks/shared/useVolver";

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
import { Hint } from "@/components/shared/Hint";

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
  tieneLinkActivo: boolean;
  onCompartirTracking: () => void;
  onRevocarTracking: () => void;
  onAbrirEliminar: () => void;
  onAbrirDuplicar: () => void;
  onNavigateTab: (tab: "documentos" | "tracking" | "cierre") => void;
}


export function EmbarqueDetalleHeader({
  embarque, embarqueId, estadoVisual, siguienteEstado, canEdit,
  trackingPending, tieneLinkActivo, onCompartirTracking, onRevocarTracking,
  onAbrirEliminar, onAbrirDuplicar,
  onNavigateTab,
}: Props) {

  const volver = useVolver("/embarques");
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
        backTo={volver}
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
                  className="text-body-sm hover:text-foreground hover:underline"
                >
                  Cotización origen: {cotizacionFolio}
                </Link>
              ) : (
                <span className="text-body-sm">Cotización origen no disponible</span>
              )
            ) : (
              <Hint label="Embarque legacy sin cotización vinculada (creado antes de la política tarifa-first)">
                <span className="text-body-sm text-warning">
                  Sin cotización vinculada
                </span>
              </Hint>
            )}
          </>
        }
        trailing={
          <EmbarqueDetalleHeaderActions
            contexto={{
              expediente: labelExpediente(embarque.expediente, embarque.id),
              estadoVisual, siguienteEstado, canEdit, embarqueId,
            }}
            estado={{
              avanzandoEstado: avanzarEstado.isPending,
              trackingPending,
              tieneLinkActivo,
              puedeReabrir,
              reabriendoEstado: reabrirEmbarque.isPending,
              docsFaltantes,
              bloqueadoPorDocs,
              cancelandoEmbarque: avanzarEstado.isPending,
              tieneDeudaPendiente,
            }}
            cierre={{ cierreEsSiguiente, rolPuedeCerrar, cierrePuedeAvanzar, cierreMotivoBloqueo }}
            acciones={{
              onAvanzarEstado: handleAvanzarEstado,
              onCompartirTracking,
              onRevocarTracking,
              onAbrirEliminar,
              onAbrirDuplicar,
              onReabrir: handleReabrir,
              onIrACierre,
              onIrADocumentos,
              onCancelar: handleCancelar,
            }}
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
