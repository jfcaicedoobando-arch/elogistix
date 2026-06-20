import { useNavigate } from "react-router-dom";
import { Edit, ChevronRight, Trash2, Share2, Copy, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  expediente: string;
  estadoVisual: string;
  siguienteEstado: string | null;
  canEdit: boolean;
  avanzandoEstado: boolean;
  trackingPending: boolean;
  embarqueId: string;
  puedeReabrir: boolean;
  reabriendoEstado: boolean;
  docsFaltantes: string[];
  bloqueadoPorDocs: boolean;
  onAvanzarEstado: () => void;
  onCompartirTracking: () => void;
  onAbrirEliminar: () => void;
  onAbrirDuplicar: () => void;
  onReabrir: () => void;
  // v13.89.1 — Cierre gateado
  cierreEsSiguiente: boolean;
  rolPuedeCerrar: boolean;
  cierrePuedeAvanzar: boolean;
  cierreMotivoBloqueo: "rol" | "checklist" | null;
  onIrACierre: () => void;
}

export function EmbarqueDetalleHeaderActions({
  expediente, estadoVisual, siguienteEstado, canEdit, avanzandoEstado, trackingPending,
  embarqueId, puedeReabrir, reabriendoEstado, docsFaltantes, bloqueadoPorDocs,
  onAvanzarEstado, onCompartirTracking, onAbrirEliminar, onAbrirDuplicar, onReabrir,
  cierreEsSiguiente, rolPuedeCerrar, cierreMotivoBloqueo, onIrACierre,
}: Props) {
  const navigate = useNavigate();

  // v13.89.1 — Si el siguiente estado es Cerrado y el rol no puede cerrar,
  // ocultamos el botón. El cierre se hace desde el Tab Cierre (o por admin).
  const ocultarAvance = cierreEsSiguiente && !rolPuedeCerrar;
  const cierreBloqueadoPorChecklist = cierreEsSiguiente && rolPuedeCerrar && cierreMotivoBloqueo === "checklist";
  const avanzarDisabled = avanzandoEstado || bloqueadoPorDocs || cierreBloqueadoPorChecklist;

  const avanzarBtn = (
    <Button size="sm" disabled={avanzarDisabled}>
      <ChevronRight className="h-4 w-4 mr-1" />
      Avanzar a {siguienteEstado}
    </Button>
  );

  const avanzarWithTooltip = bloqueadoPorDocs ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><span tabIndex={0}>{avanzarBtn}</span></TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Faltan documentos para pasar a {siguienteEstado}:</p>
          <p className="text-xs font-medium">{docsFaltantes.join(", ")}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : cierreBloqueadoPorChecklist ? (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span tabIndex={0} onClick={onIrACierre} className="cursor-pointer">{avanzarBtn}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">Hay pendientes administrativos.</p>
          <p className="text-xs font-medium">Click para ver el Tab Cierre.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : avanzarBtn;

  return (
    <div className="flex gap-1.5 flex-wrap lg:flex-nowrap lg:justify-end items-center">
      {canEdit && siguienteEstado && !ocultarAvance ? (
        bloqueadoPorDocs || cierreBloqueadoPorChecklist ? avanzarWithTooltip : (
          <AlertDialog>
            <AlertDialogTrigger asChild>{avanzarWithTooltip}</AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar cambio de estado</AlertDialogTitle>
                <AlertDialogDescription>
                  ¿Estás seguro de cambiar el estado de <strong>{estadoVisual}</strong> a <strong>{siguienteEstado}</strong>? Esta acción quedará registrada en la bitácora.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onAvanzarEstado}>Confirmar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )
      ) : canEdit && (!siguienteEstado || ocultarAvance) ? (
        <Button size="sm" onClick={() => navigate(`/embarques/${embarqueId}/editar`)}>
          <Edit className="h-4 w-4 mr-1" /> Editar
        </Button>
      ) : null}

      {canEdit && siguienteEstado && (
        <Button variant="outline" size="sm" onClick={() => navigate(`/embarques/${embarqueId}/editar`)}>
          <Edit className="h-4 w-4 mr-1" /> Editar
        </Button>
      )}

      <Button variant="outline" size="sm" onClick={onCompartirTracking} disabled={trackingPending}>
        <Share2 className="h-4 w-4 mr-1" /> Compartir
      </Button>

      {canEdit && (
        <Button variant="outline" size="sm" onClick={onAbrirDuplicar}>
          <Copy className="h-4 w-4 mr-1" /> Duplicar
        </Button>
      )}

      {puedeReabrir && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={reabriendoEstado}>
              <Unlock className="h-4 w-4 mr-1" /> Reabrir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reabrir embarque cerrado</AlertDialogTitle>
              <AlertDialogDescription>
                El embarque <strong>{expediente}</strong> regresará al estado <strong>Entregado</strong> para poder generar la proforma o ajustar facturación. La acción se registrará en la bitácora y en el tracking.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onReabrir}>Reabrir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {canEdit && (
        <>
          <span aria-hidden="true" className="hidden sm:inline-block h-6 w-px bg-border mx-1" />
          <Button
            variant="ghost" size="sm" onClick={onAbrirEliminar}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-1" /> Eliminar
          </Button>
        </>
      )}
    </div>
  );
}
