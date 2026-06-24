import { ChevronRight } from "lucide-react";
import { dialogSize } from "@/components/shared/utils/dialogTokens";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  estadoVisual: string;
  siguienteEstado: string;
  avanzandoEstado: boolean;
  bloqueadoPorDocs: boolean;
  docsFaltantes: string[];
  cierreBloqueadoPorChecklist: boolean;
  onAvanzarEstado: () => void;
  onIrACierre: () => void;
}

export function AvanzarEstadoButton({
  estadoVisual, siguienteEstado, avanzandoEstado,
  bloqueadoPorDocs, docsFaltantes, cierreBloqueadoPorChecklist,
  onAvanzarEstado, onIrACierre,
}: Props) {
  const disabled = avanzandoEstado || bloqueadoPorDocs || cierreBloqueadoPorChecklist;

  const btn = (
    <Button size="sm" disabled={disabled}>
      <ChevronRight className="h-4 w-4 mr-1" />
      Avanzar a {siguienteEstado}
    </Button>
  );

  if (bloqueadoPorDocs) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild><span tabIndex={0}>{btn}</span></TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Faltan documentos para pasar a {siguienteEstado}:</p>
            <p className="text-xs font-medium">{docsFaltantes.join(", ")}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (cierreBloqueadoPorChecklist) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span tabIndex={0} onClick={onIrACierre} className="cursor-pointer">{btn}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Hay pendientes administrativos.</p>
            <p className="text-xs font-medium">Click para ver el Tab Cierre.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{btn}</AlertDialogTrigger>
      <AlertDialogContent className={dialogSize.sm}>
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
  );
}
