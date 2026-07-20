/**
 * Botón "Avanzar a <siguiente estado>" del header de embarque.
 * v13.232.0 · Migrado a `ConfirmActionDialog` (Lote 7d.2).
 */
import { useState } from "react";
import { ChevronRight, FileWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { labelEstadoEmbarque } from "@/features/embarques/constants/estadoEmbarqueLabels";

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
  const [dialogOpen, setDialogOpen] = useState(false);
  const siguienteLabel = labelEstadoEmbarque(siguienteEstado);
  const actualLabel = labelEstadoEmbarque(estadoVisual);

  // v13.142.5 — Cuando faltan docs, el botón NO se deshabilita: abre un
  // AlertDialog explicativo. Esto reemplaza el tooltip (invisible en móvil).
  if (bloqueadoPorDocs) {
    return (
      <>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" disabled={avanzandoEstado} onClick={() => setDialogOpen(true)}>
                <ChevronRight className="h-4 w-4 mr-1" />
                Avanzar a {siguienteLabel}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">Faltan documentos para pasar a {siguienteLabel}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ConfirmActionDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="No se puede avanzar"
          titleIcon={<FileWarning className="h-5 w-5 text-destructive" aria-hidden />}
          titleDestructive
          confirmLabel="Ir a Documentos"
          cancelLabel="Cerrar"
          onConfirm={() => { setDialogOpen(false); onIrADocumentos(); }}
          description={
            <div className="space-y-2">
              <p>Para pasar a <strong>{siguienteLabel}</strong> es obligatorio tener cargados (o marcados como "No aplica") estos documentos:</p>
              <ul className="list-disc list-inside text-sm">
                {docsFaltantes.map((d) => <li key={d}>{d}</li>)}
              </ul>
            </div>
          }
        />
      </>
    );
  }

  if (cierreBloqueadoPorChecklist) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button size="sm" onClick={onIrACierre} disabled={avanzandoEstado}>
              <ChevronRight className="h-4 w-4 mr-1" />
              Avanzar a {siguienteLabel}
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
    <>
      <Button size="sm" disabled={avanzandoEstado} onClick={() => setDialogOpen(true)}>
        <ChevronRight className="h-4 w-4 mr-1" />
        Avanzar a {siguienteLabel}
      </Button>
      <ConfirmActionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Confirmar cambio de estado"
        confirmLabel="Confirmar"
        isPending={avanzandoEstado}
        onConfirm={() => { setDialogOpen(false); onAvanzarEstado(); }}
        description={
          <>¿Estás seguro de cambiar el estado de <strong>{actualLabel}</strong> a <strong>{siguienteLabel}</strong>? Esta acción quedará registrada en la bitácora.</>
        }
      />
    </>
  );
}
