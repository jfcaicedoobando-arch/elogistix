import { useNavigate } from "react-router-dom";
import { ArrowLeft, Edit, Printer, ChevronRight, Copy, Trash2, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getEstadoColor, getModoIcon } from "@/lib/ui/uiMappings";
import { ProformaBadge } from "./ProformaBadge";
import type { EmbarqueRow } from "@/hooks/embarque/useEmbarques";

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
  onAbrirDuplicar: () => void;
  onAbrirEliminar: () => void;
}

export function EmbarqueDetalleHeader({
  embarque, estadoVisual, siguienteEstado, canEdit, avanzandoEstado,
  trackingPending, embarqueId, onAvanzarEstado, onCompartirTracking,
  onAbrirDuplicar, onAbrirEliminar,
}: Props) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <Button variant="ghost" size="icon" onClick={() => navigate("/embarques")} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{embarque.expediente}</h1>
            <Badge className={getEstadoColor(estadoVisual)}>{estadoVisual}</Badge>
            <span className="text-lg">{getModoIcon(embarque.modo)}</span>
            <ProformaBadge tieneProforma={embarque.tiene_proforma} size="lg" />
          </div>
          <p className="text-sm text-muted-foreground truncate">{embarque.cliente_nombre}</p>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap lg:justify-end">
        {canEdit && siguienteEstado && (
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
        )}
        {canEdit && <Button variant="outline" size="sm" onClick={() => navigate(`/embarques/${embarqueId}/editar`)}><Edit className="h-4 w-4 mr-1" /> Editar</Button>}
        {canEdit && <Button variant="outline" size="sm" onClick={onAbrirDuplicar}><Copy className="h-4 w-4 mr-1" /> Duplicar</Button>}
        <Button variant="outline" size="sm" onClick={onCompartirTracking} disabled={trackingPending}>
          <Share2 className="h-4 w-4 mr-1" /> Compartir
        </Button>
        <Button variant="outline" size="sm"><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
        {canEdit && (
          <Button variant="destructive" size="sm" onClick={onAbrirEliminar}>
            <Trash2 className="h-4 w-4 mr-1" /> Eliminar
          </Button>
        )}
      </div>
    </div>
  );
}
