import { useNavigate } from "react-router-dom";
import { Edit, Trash2, Share2, Copy, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AvanzarEstadoButton } from "./header/AvanzarEstadoButton";

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
  cierreEsSiguiente, rolPuedeCerrar, cierrePuedeAvanzar, cierreMotivoBloqueo, onIrACierre,
}: Props) {
  const navigate = useNavigate();

  const ocultarAvance = cierreEsSiguiente && !rolPuedeCerrar;
  const cierreBloqueadoPorChecklist =
    cierreEsSiguiente && rolPuedeCerrar && !cierrePuedeAvanzar && cierreMotivoBloqueo === "checklist";

  const mostrarAvanzar = canEdit && siguienteEstado && !ocultarAvance;
  const mostrarEditarSecundario = canEdit && siguienteEstado;
  const mostrarEditarPrincipal = canEdit && (!siguienteEstado || ocultarAvance);

  return (
    <div className="flex gap-1.5 flex-wrap lg:flex-nowrap lg:justify-end items-center">
      {mostrarAvanzar && siguienteEstado ? (
        <AvanzarEstadoButton
          estadoVisual={estadoVisual}
          siguienteEstado={siguienteEstado}
          avanzandoEstado={avanzandoEstado}
          bloqueadoPorDocs={bloqueadoPorDocs}
          docsFaltantes={docsFaltantes}
          cierreBloqueadoPorChecklist={cierreBloqueadoPorChecklist}
          onAvanzarEstado={onAvanzarEstado}
          onIrACierre={onIrACierre}
        />
      ) : mostrarEditarPrincipal ? (
        <Button size="sm" onClick={() => navigate(`/embarques/${embarqueId}/editar`)}>
          <Edit className="h-4 w-4 mr-1" /> Editar
        </Button>
      ) : null}

      {mostrarEditarSecundario && (
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
