/**
 * Menú compacto para una fila de actividad: Completar, Posponer y Notas.
 * Las notas siguen disponibles incluso en actividades completadas.
 */
import { useState } from "react";
import { CheckCircle2, Clock, FileText, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCompletarActividad, usePosponerActividad, type CrmActividadRow,
} from "@/features/crm/hooks";
import ActividadNotasSheet from "@/features/crm/components/actividades/ActividadNotasSheet";

interface Props { actividad: CrmActividadRow }

export default function ActividadRowActions({ actividad }: Props) {
  const completar = useCompletarActividad();
  const posponer = usePosponerActividad();
  const [notasOpen, setNotasOpen] = useState(false);
  const completada = !!actividad.fecha_completada;

  const handleCompletar = async () => {
    // El hook `useCompletarActividad` ya notifica éxito y error: un solo aviso.
    try {
      await completar.mutateAsync({ id: actividad.id });
    } catch {
      /* notificado por el hook */
    }
  };

  const handlePosponer = async (dias: number) => {
    // El hook `usePosponerActividad` ya notifica éxito y error: un solo aviso.
    try {
      await posponer.mutateAsync({ id: actividad.id, dias, fechaProgramada: actividad.fecha_programada });
    } catch {
      /* notificado por el hook */
    }
  };

  return (
    <>
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="h-8 w-8"
              disabled={completar.isPending || posponer.isPending}
              loading={completar.isPending || posponer.isPending}
              aria-label="Acciones de actividad">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {!completada && (
              <>
                <DropdownMenuItem onSelect={() => void handleCompletar()}>
                  <CheckCircle2 className="mr-2 h-4 w-4 text-success" />Marcar como completada
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger><Clock className="mr-2 h-4 w-4" />Posponer</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => void handlePosponer(1)}>+1 día</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handlePosponer(3)}>+3 días</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void handlePosponer(7)}>+1 semana</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={() => setNotasOpen(true)}>
              <FileText className="mr-2 h-4 w-4" />Notas / resultado
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <ActividadNotasSheet
        actividad={actividad}
        open={notasOpen}
        onOpenChange={setNotasOpen}
      />
    </>
  );
}
