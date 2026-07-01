import { ChevronRight, FileWarning } from "lucide-react";
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
  onIrADocumentos: () => void;
}

export function AvanzarEstadoButton({
  estadoVisual, siguienteEstado, avanzandoEstado,
  bloqueadoPorDocs, docsFaltantes, cierreBloqueadoPorChecklist,
  onAvanzarEstado, onIrACierre, onIrADocumentos,
}: Props) {
  // v13.142.5 — Cuando faltan docs, el botón NO se deshabilita: abre un
  // AlertDialog explicativo. Esto reemplaza el tooltip (invisible en móvil).
  if (bloqueadoPorDocs) {
    const trigger = (
      <Button size="sm" disabled={avanzandoEstado}>
        <ChevronRight className="h-4 w-4 mr-1" />
        Avanzar a {siguienteEstado}
      </Button>
    );
    return (
      <TooltipProvider>
        <Tooltip>
          <AlertDialog>
            <TooltipTrigger asChild>
              <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Faltan documentos para pasar a {siguienteEstado}</p>
            </TooltipContent>
            <AlertDialogContent className={dialogSize.sm}>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <FileWarning className="h-5 w-5 text-destructive" /> No se puede avanzar
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-2">
                    <p>Para pasar a <strong>{siguienteEstado}</strong> es obligatorio tener cargados (o marcados como "No aplica") estos documentos:</p>
                    <ul className="list-disc list-inside text-sm">
                      {docsFaltantes.map((d) => <li key={d}>{d}</li>)}
                    </ul>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cerrar</AlertDialogCancel>
                <AlertDialogAction onClick={onIrADocumentos}>Ir a Documentos</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (cierreBloqueadoPorChecklist) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" onClick={onIrACierre} disabled={avanzandoEstado}>
              <ChevronRight className="h-4 w-4 mr-1" />
              Avanzar a {siguienteEstado}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">Hay pendientes administrativos.</p>
            <p className="text-xs font-medium">Ir al tab Cierre.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" disabled={avanzandoEstado}>
          <ChevronRight className="h-4 w-4 mr-1" />
          Avanzar a {siguienteEstado}
        </Button>
      </AlertDialogTrigger>
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
