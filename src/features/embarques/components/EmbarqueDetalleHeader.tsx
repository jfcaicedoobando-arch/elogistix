import { Link } from "react-router-dom";
import { labelExpediente } from "@/features/embarques/domain/labelExpediente";

import { toTitleCase } from "@/lib/formatters";
import { EmbarqueStatusChip } from "./EmbarqueStatusChip";
import { EmbarqueBadgeAdmin } from "./EmbarqueBadgeAdmin";
import { EmbarqueHeaderDialogs } from "./EmbarqueHeaderDialogs";
import { EmbarqueDetalleHeaderActions } from "./EmbarqueDetalleHeaderActions";
import { usePermissions } from "@/hooks/shared/usePermissions";
import { useCotizacionFolio } from "@/features/cotizacion/hooks";
import type { EmbarqueRow } from "@/features/embarques/hooks";

interface Props {
  embarque: EmbarqueRow;
  estadoVisual: string;
  siguienteEstado: string | null;
  canEdit: boolean;
  avanzandoEstado: boolean;
  trackingPending: boolean;
  embarqueId: string;
  onAvanzarEstado: () => void;
  onCompartirTracking: () => void;
  onAbrirEliminar: () => void;
  onAbrirDuplicar: () => void;
  onReabrir: () => void;
  reabriendoEstado: boolean;
  // Soft warning al cerrar sin proforma
  warnCierreOpen: boolean;
  onWarnCierreOpenChange: (open: boolean) => void;
  onConfirmarCierreSinProforma: () => void;
  conceptosSinProforma: number;
  // Candado de documentos
  docsFaltantes: string[];
  docsBloqueantes: boolean;
  warnDocsOpen: boolean;
  onWarnDocsOpenChange: (open: boolean) => void;
  blockDocsOpen: boolean;
  onBlockDocsOpenChange: (open: boolean) => void;
  onConfirmarAvanceConDocsPendientes: () => void;
  onIrADocumentos: () => void;
  // Fecha de llegada real obligatoria al avanzar a Arribo
  blockFechaLlegadaOpen: boolean;
  onBlockFechaLlegadaOpenChange: (open: boolean) => void;
  onIrATracking: () => void;
  // v13.89.1 — Cierre gateado
  cierreEsSiguiente: boolean;
  rolPuedeCerrar: boolean;
  cierrePuedeAvanzar: boolean;
  cierreMotivoBloqueo: "rol" | "checklist" | null;
  onIrACierre: () => void;
}


export function EmbarqueDetalleHeader({
  embarque, estadoVisual, siguienteEstado, canEdit, avanzandoEstado,
  trackingPending, embarqueId, onAvanzarEstado, onCompartirTracking,
  onAbrirEliminar, onAbrirDuplicar,
  onReabrir, reabriendoEstado,
  warnCierreOpen, onWarnCierreOpenChange, onConfirmarCierreSinProforma, conceptosSinProforma,
  docsFaltantes, docsBloqueantes,
  warnDocsOpen, onWarnDocsOpenChange,
  blockDocsOpen, onBlockDocsOpenChange,
  onConfirmarAvanceConDocsPendientes, onIrADocumentos,
  blockFechaLlegadaOpen, onBlockFechaLlegadaOpenChange, onIrATracking,
  cierreEsSiguiente, rolPuedeCerrar, cierrePuedeAvanzar, cierreMotivoBloqueo, onIrACierre,
}: Props) {

  const { isAdmin } = usePermissions();
  const puedeReabrir = isAdmin && estadoVisual === "Cerrado";
  const bloqueadoPorDocs = docsBloqueantes && docsFaltantes.length > 0;
  const { data: cotizacionFolio } = useCotizacionFolio(embarque.cotizacion_id);

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold truncate">{labelExpediente(embarque.expediente, embarque.id)}</h1>
          <EmbarqueStatusChip
            estado={estadoVisual}
            modo={embarque.modo}
            tieneProforma={embarque.tiene_proforma}
            cobroStatus={embarque.cobro_cliente_status as "pendiente" | "parcial" | "pagado" | null | undefined}
          />
          <EmbarqueBadgeAdmin embarqueId={embarqueId} estado={estadoVisual} />
        </div>
        <p className="text-sm text-muted-foreground truncate mt-1">
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
        </p>
      </div>

      <EmbarqueDetalleHeaderActions
        expediente={embarque.expediente}
        estadoVisual={estadoVisual}
        siguienteEstado={siguienteEstado}
        canEdit={canEdit}
        avanzandoEstado={avanzandoEstado}
        trackingPending={trackingPending}
        embarqueId={embarqueId}
        puedeReabrir={puedeReabrir}
        reabriendoEstado={reabriendoEstado}
        docsFaltantes={docsFaltantes}
        bloqueadoPorDocs={bloqueadoPorDocs}
        onAvanzarEstado={onAvanzarEstado}
        onCompartirTracking={onCompartirTracking}
        onAbrirEliminar={onAbrirEliminar}
        onAbrirDuplicar={onAbrirDuplicar}
        onReabrir={onReabrir}
        cierreEsSiguiente={cierreEsSiguiente}
        rolPuedeCerrar={rolPuedeCerrar}
        cierrePuedeAvanzar={cierrePuedeAvanzar}
        cierreMotivoBloqueo={cierreMotivoBloqueo}
        onIrACierre={onIrACierre}
        onIrADocumentos={onIrADocumentos}
      />

      <EmbarqueHeaderDialogs
        siguienteEstado={siguienteEstado}
        warnCierreOpen={warnCierreOpen}
        onWarnCierreOpenChange={onWarnCierreOpenChange}
        onConfirmarCierreSinProforma={onConfirmarCierreSinProforma}
        conceptosSinProforma={conceptosSinProforma}
        docsFaltantes={docsFaltantes}
        warnDocsOpen={warnDocsOpen}
        onWarnDocsOpenChange={onWarnDocsOpenChange}
        blockDocsOpen={blockDocsOpen}
        onBlockDocsOpenChange={onBlockDocsOpenChange}
        onConfirmarAvanceConDocsPendientes={onConfirmarAvanceConDocsPendientes}
        onIrADocumentos={onIrADocumentos}
        blockFechaLlegadaOpen={blockFechaLlegadaOpen}
        onBlockFechaLlegadaOpenChange={onBlockFechaLlegadaOpenChange}
        onIrATracking={onIrATracking}
      />

    </div>
  );
}
