import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
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
          <h1 className="text-2xl font-bold truncate">{embarque.expediente}</h1>
          <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
          <Badge variant="outline" className="gap-1 font-normal">
            <ModoIcon modo={embarque.modo} size={12} />
            {embarque.modo}
          </Badge>
          <ProformaBadge tieneProforma={embarque.tiene_proforma} size="sm" />
          <EmbarqueBadgeAdmin embarqueId={embarqueId} estado={estadoVisual} />
          <CobroClienteBadge status={embarque.cobro_cliente_status as "pendiente" | "parcial" | "pagado" | null | undefined} />
        </div>
        <p className="text-sm text-muted-foreground truncate mt-1">{toTitleCase(embarque.cliente_nombre)}</p>
        {embarque.cotizacion_id ? (
          <div className="mt-1.5">
            {cotizacionFolio ? (
              <Link to={`/cotizaciones/${embarque.cotizacion_id}`}>
                <Badge variant="outline" className="gap-1 hover:bg-muted cursor-pointer">
                  <FileText className="h-3 w-3" />
                  Generado desde {cotizacionFolio}
                </Badge>
              </Link>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <FileText className="h-3 w-3" />
                Cotización origen no disponible
              </Badge>
            )}
          </div>
        ) : (
          <div className="mt-1.5">
            <Badge variant="warning" className="gap-1" title="Embarque creado sin cotización vinculada">
              <FileText className="h-3 w-3" />
              Sin cotización
            </Badge>
          </div>
        )}
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
