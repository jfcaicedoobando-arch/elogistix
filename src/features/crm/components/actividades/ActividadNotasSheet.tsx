/**
 * ActividadNotasSheet — Sheet ligero para editar el campo `resultado` (notas)
 * de una actividad sin abrir el diálogo completo.
 *
 * VIS-249-01: cerrar con Escape, la X, clic fuera o "Cancelar" con texto
 * modificado pide confirmación antes de descartar (mismo mecanismo que
 * `FormDialogShell`: `ConfirmActionDialog`). Sin cambios se cierra directo y
 * un guardado fallido conserva el texto. No hay autosave ni borradores.
 */
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { ConfirmActionDialog } from "@/components/shared/ConfirmActionDialog";
import { useActualizarActividadNotas } from "@/features/crm/hooks";
import type { CrmActividadRow } from "@/features/crm/hooks";
import { crmToast } from "@/features/crm/lib/crmToast";
import { formSheet } from "@/components/shared/utils/dialogTokens";

interface Props {
  actividad: CrmActividadRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ActividadNotasSheet({ actividad, open, onOpenChange }: Props) {
  const [resultado, setResultado] = useState("");
  const [confirmarDescartar, setConfirmarDescartar] = useState(false);
  const mutate = useActualizarActividadNotas();
  const guardado = actividad?.resultado ?? "";
  const isDirty = open && resultado !== guardado;

  useEffect(() => {
    if (open && actividad) setResultado(actividad.resultado ?? "");
    if (!open) setConfirmarDescartar(false);
  }, [open, actividad]);

  // Escape, X y clic fuera pasan por aquí igual que el botón "Cancelar".
  const pedirCierre = useCallback(
    (next: boolean) => {
      if (next) { onOpenChange(true); return; }
      if (isDirty) { setConfirmarDescartar(true); return; }
      onOpenChange(false);
    },
    [isDirty, onOpenChange],
  );

  const handleGuardar = async () => {
    if (!actividad) return;
    try {
      await mutate.mutateAsync({ id: actividad.id, resultado });
      crmToast.success("Notas guardadas");
      onOpenChange(false);
    } catch {
      // useActualizarActividadNotas ya notifica el error en onError.
      // El texto capturado se conserva a propósito para reintentar.
    }
  };

  return (
    <Sheet open={open} onOpenChange={pedirCierre}>
      <SheetContent side="right" className={formSheet}>
        <SheetHeader>
          <SheetTitle>Notas de actividad</SheetTitle>
          <SheetDescription className="line-clamp-1">
            {actividad?.asunto ?? ""}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-2 py-4">
          <Label htmlFor="resultado">Resultado / notas</Label>
          <Textarea
            id="resultado"
            rows={10}
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
            placeholder="¿Qué pasó? ¿Próximos pasos?"
          />
        </div>
        <SheetFooter>
          <Button variant="outline" onClick={() => pedirCierre(false)}>Cancelar</Button>
          <Button onClick={handleGuardar} loading={mutate.isPending}>
            Guardar
          </Button>
        </SheetFooter>

        <ConfirmActionDialog
          open={confirmarDescartar}
          onOpenChange={setConfirmarDescartar}
          title="¿Descartar las notas?"
          description="Escribiste notas que aún no se han guardado. Si cierras ahora, se perderán."
          confirmLabel="Descartar"
          cancelLabel="Seguir editando"
          variant="destructive"
          onConfirm={() => {
            setConfirmarDescartar(false);
            onOpenChange(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
