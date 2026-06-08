import { useNavigate } from "react-router-dom";
import { Edit, ChevronRight, Trash2, Share2, Copy, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getEstadoColor } from "@/components/shared/utils/uiMappings";
import { toTitleCase } from "@/lib/formatters";
import { ModoIcon } from "@/components/shared/ModoIcon";
import { ProformaBadge } from "./ProformaBadge";
import { usePermissions } from "@/hooks/shared/usePermissions";
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
  // Reapertura admin (solo visible cuando estado === 'Cerrado' y rol admin/super_admin)
  onReabrir: () => void;
  reabriendoEstado: boolean;
  // Soft warning al cerrar sin proforma
  warnCierreOpen: boolean;
  onWarnCierreOpenChange: (open: boolean) => void;
  onConfirmarCierreSinProforma: () => void;
  conceptosSinProforma: number;
}

export function EmbarqueDetalleHeader({
  embarque, estadoVisual, siguienteEstado, canEdit, avanzandoEstado,
  trackingPending, embarqueId, onAvanzarEstado, onCompartirTracking,
  onAbrirEliminar, onAbrirDuplicar,
  onReabrir, reabriendoEstado,
  warnCierreOpen, onWarnCierreOpenChange, onConfirmarCierreSinProforma, conceptosSinProforma,
}: Props) {

  const navigate = useNavigate();
  const { isAdmin } = usePermissions();
  const puedeReabrir = isAdmin && estadoVisual === "Cerrado";

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-2xl font-bold truncate">{embarque.expediente}</h1>
          <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
          <ModoIcon modo={embarque.modo} size={18} circle />
          <ProformaBadge tieneProforma={embarque.tiene_proforma} size="sm" />
        </div>
        <p className="text-sm text-muted-foreground truncate mt-1">{toTitleCase(embarque.cliente_nombre)}</p>
      </div>
      <div className="flex gap-1.5 flex-wrap lg:flex-nowrap lg:justify-end items-center">
        {/* Acción primaria: avanzar estado (workflow). Si no aplica, Editar pasa a primaria. */}
        {canEdit && siguienteEstado ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" disabled={avanzandoEstado}>
                <ChevronRight className="h-4 w-4 mr-1" />
                Avanzar a {siguienteEstado}
              </Button>
            </AlertDialogTrigger>
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
        ) : canEdit ? (
          <Button size="sm" onClick={() => navigate(`/embarques/${embarqueId}/editar`)}>
            <Edit className="h-4 w-4 mr-1" /> Editar
          </Button>
        ) : null}

        {/* Editar (cuando "Avanzar" toma la primaria) */}
        {canEdit && siguienteEstado && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/embarques/${embarqueId}/editar`)}
          >
            <Edit className="h-4 w-4 mr-1" /> Editar
          </Button>
        )}

        {/* Compartir (frecuente, no destructiva) */}
        <Button variant="outline" size="sm" onClick={onCompartirTracking} disabled={trackingPending}>
          <Share2 className="h-4 w-4 mr-1" /> Compartir
        </Button>

        {/* Duplicar */}
        {canEdit && (
          <Button variant="outline" size="sm" onClick={onAbrirDuplicar}>
            <Copy className="h-4 w-4 mr-1" /> Duplicar
          </Button>
        )}

        {/* Reabrir embarque cerrado (solo admin / super_admin) */}
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
                  El embarque <strong>{embarque.expediente}</strong> regresará al estado <strong>Entregado</strong> para poder generar la proforma o ajustar facturación. La acción se registrará en la bitácora y en el tracking.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={onReabrir}>Reabrir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {/* Separador visual antes de la acción destructiva */}
        {canEdit && (
          <>
            <span aria-hidden="true" className="hidden sm:inline-block h-6 w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={onAbrirEliminar}
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-1" /> Eliminar
            </Button>
          </>
        )}
      </div>

      {/* Soft warning: cerrar con conceptos de venta aún sin proforma */}
      <AlertDialog open={warnCierreOpen} onOpenChange={onWarnCierreOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hay conceptos sin facturar</AlertDialogTitle>
            <AlertDialogDescription>
              Este embarque tiene <strong>{conceptosSinProforma}</strong> concepto(s) de venta sin proforma generada. Si lo cierras ahora tendrás que pedirle a un administrador que lo reabra para poder facturar. ¿Cerrar de todas formas?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onConfirmarCierreSinProforma}>Cerrar de todas formas</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
