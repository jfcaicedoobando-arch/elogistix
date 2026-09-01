import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Edit, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccionPrincipalEmbarque } from "./header/AccionPrincipalEmbarque";
import { ReabrirEmbarqueButton } from "./header/ReabrirEmbarqueButton";
import { CancelarEmbarqueDialog } from "./header/CancelarEmbarqueDialog";
import { MenuMasAccionesEmbarque } from "./header/MenuMasAccionesEmbarque";
import { usePermissions } from "@/hooks/shared/usePermissions";

/** Identidad y permisos del embarque (auditoría 2026-08-18, punto 7). */
export interface AccionesEmbarqueContexto {
  expediente: string;
  estadoVisual: string;
  siguienteEstado: string | null;
  canEdit: boolean;
  embarqueId: string;
}

/** Estado en vivo: banderas de carga y bloqueos. */
export interface AccionesEmbarqueEstado {
  avanzandoEstado: boolean;
  trackingPending: boolean;
  tieneLinkActivo: boolean;
  puedeReabrir: boolean;
  reabriendoEstado: boolean;
  docsFaltantes: string[];
  bloqueadoPorDocs: boolean;
  cancelandoEmbarque: boolean;
  tieneDeudaPendiente: boolean;
}

/** Gate de cierre (v13.89.1). */
export interface AccionesEmbarqueCierre {
  cierreEsSiguiente: boolean;
  rolPuedeCerrar: boolean;
  cierrePuedeAvanzar: boolean;
  cierreMotivoBloqueo: "rol" | "checklist" | null;
}

/** Callbacks disparados por el usuario. */
export interface AccionesEmbarqueCallbacks {
  onAvanzarEstado: () => void;
  onCompartirTracking: () => void;
  onRevocarTracking: () => void;
  onAbrirEliminar: () => void;
  onAbrirDuplicar: () => void;
  onReabrir: (motivo: string) => void;
  onIrACierre: () => void;
  onIrADocumentos: () => void;
  onCancelar: (motivo: string) => Promise<void> | void;
}

interface Props {
  contexto: AccionesEmbarqueContexto;
  estado: AccionesEmbarqueEstado;
  cierre: AccionesEmbarqueCierre;
  acciones: AccionesEmbarqueCallbacks;
}

// v13.820.3: la UI se alinea al guard del RPC `eliminar_embarque`: sólo
// `Cerrado`/`Cancelado` bloquean el borrado por estado; las dependencias
// fiscales las valida la base de datos.
const ESTADOS_BLOQUEAN_BORRADO = ["Cerrado", "Cancelado"];
const ESTADOS_CANCELABLES = ["Borrador", "Confirmado", "En Tránsito", "Llegada", "En Aduana", "Arribo"];

/** Lint (complejidad): derivaciones de estado fuera del componente. */
function derivarEstadoAcciones(estadoVisual: string) {
  return {
    esTerminal: ESTADOS_BLOQUEAN_BORRADO.includes(estadoVisual),
    puedeCancelar: ESTADOS_CANCELABLES.includes(estadoVisual),
  };
}


export function EmbarqueDetalleHeaderActions({
  contexto, estado, cierre, acciones,
}: Props) {
  const { expediente, estadoVisual, siguienteEstado, canEdit, embarqueId } = contexto;
  const {
    avanzandoEstado, trackingPending, tieneLinkActivo, puedeReabrir, reabriendoEstado,
    docsFaltantes, bloqueadoPorDocs, cancelandoEmbarque, tieneDeudaPendiente,
  } = estado;
  const { cierreEsSiguiente, rolPuedeCerrar, cierrePuedeAvanzar, cierreMotivoBloqueo } = cierre;
  const {
    onAvanzarEstado, onCompartirTracking, onRevocarTracking, onAbrirEliminar, onAbrirDuplicar,
    onReabrir, onIrACierre, onIrADocumentos, onCancelar,
  } = acciones;
  // B-058 (v13.320.39): en estados terminales/cerrados el borrado ya no aplica.
  const { esTerminal, puedeCancelar } = derivarEstadoAcciones(estadoVisual);
  // FIX C1 (S5-01): el borrado exige rol admin/operador, igual que el guard del RPC.
  const { canEliminarEmbarque } = usePermissions();
  const puedeEliminar = !esTerminal && !tieneDeudaPendiente && canEliminarEmbarque;
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const navigate = useNavigate();
  const goEditar = () => navigate(`/embarques/${embarqueId}/editar`);

  const ocultarAvance = cierreEsSiguiente && !rolPuedeCerrar;
  const cierreBloqueadoPorChecklist =
    cierreEsSiguiente && rolPuedeCerrar && !cierrePuedeAvanzar && cierreMotivoBloqueo === "checklist";

  const accionPrincipal = AccionPrincipalEmbarque({
    canEdit, siguienteEstado, ocultarAvance, estadoVisual, avanzandoEstado,
    bloqueadoPorDocs, docsFaltantes, cierreBloqueadoPorChecklist,
    onAvanzarEstado, onIrACierre, onIrADocumentos, goEditar,
  });

  return (
    <div className="flex gap-1.5 flex-wrap lg:flex-nowrap lg:justify-end items-center">
      {accionPrincipal}
      {canEdit && siguienteEstado && !ocultarAvance && (
        <Button variant="outline" size="sm" onClick={goEditar}>
          <Edit className="h-4 w-4 mr-1" /> Editar
        </Button>
      )}
      {canEdit && ocultarAvance && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="gap-1 text-muted-foreground cursor-default">
              <Lock className="h-3 w-3" /> Cierre restringido
            </Badge>
          </TooltipTrigger>
          <TooltipContent>Requiere finanzas o admin para cerrar el embarque</TooltipContent>
        </Tooltip>
      )}

      {puedeReabrir && (
        <ReabrirEmbarqueButton
          expediente={expediente}
          reabriendoEstado={reabriendoEstado}
          onReabrir={onReabrir}
        />
      )}

      {canEdit && (
        <MenuMasAccionesEmbarque
          trackingPending={trackingPending}
          tieneLinkActivo={tieneLinkActivo}
          puedeCancelar={puedeCancelar}
          puedeEliminar={puedeEliminar}
          esTerminal={esTerminal}
          canEliminarEmbarque={canEliminarEmbarque}
          onCompartirTracking={onCompartirTracking}
          onRevocarTracking={onRevocarTracking}
          onAbrirDuplicar={onAbrirDuplicar}
          onAbrirEliminar={onAbrirEliminar}
          onPedirCancelar={() => setCancelarOpen(true)}
        />
      )}
      <CancelarEmbarqueDialog
        open={cancelarOpen}
        onOpenChange={setCancelarOpen}
        expediente={expediente}
        isPending={cancelandoEmbarque}
        onConfirm={onCancelar}
      />
    </div>
  );
}

