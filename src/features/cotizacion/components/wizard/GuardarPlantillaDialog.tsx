/**
 * Dialog para guardar la cotización actual como plantilla (P2 cierre — v13.296.0).
 * Migrado a FormDialogShell (regla core "modales tipo formulario").
 */
import { useState } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import { BookmarkPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { useGuardarPlantilla, type PlantillaVisibilidad } from "@/features/cotizacion/hooks/useCotizacionPlantillas";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";
import { limpiarValues } from "./guardarPlantillaHelpers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  usuarioId: string | null;
  /** Valores actuales del wizard. Se limpian antes de guardar (sin folios/fechas). */
  values: Partial<CotizacionFormValues>;
  onSaved?: () => void;
}

export function GuardarPlantillaDialog({
  open, onOpenChange, organizationId, usuarioId, values, onSaved,
}: Props) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [visibilidad, setVisibilidad] = useState<PlantillaVisibilidad>("yo");
  const guardar = useGuardarPlantilla();

  const puede = !!organizationId && !!usuarioId && nombre.trim().length >= 3;

  const handleClose = (o: boolean) => {
    if (!o) {
      setNombre("");
      setDescripcion("");
      setVisibilidad("yo");
    }
    onOpenChange(o);
  };

  const handleGuardar = async () => {
    if (!puede || !organizationId || !usuarioId) return;
    try {
      await guardar.mutateAsync({
        organizationId,
        usuarioId,
        nombre,
        descripcion,
        visibilidad,
        values: limpiarValues(values),
      });
      notifySuccess(undefined, { title: "Plantilla guardada" });
      onSaved?.();
      handleClose(false);
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo guardar la plantilla",
        error: err,
        method: "GuardarPlantillaDialog.submit",
      });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={handleClose}
      icon={BookmarkPlus}
      title="Guardar como plantilla"
      description="Reutiliza esta cotización como base para cotizaciones futuras. Se guarda ruta, cliente, incoterms y conceptos base (no folios ni fechas)."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={!puede || guardar.isPending}>
            {guardar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar plantilla
          </Button>
        </>
      }
    >
      <FormDialogSection title="Identificación" cols={1}>
        <div className="space-y-1.5">
          <Label htmlFor="pl-nombre">
            Nombre <span className="text-destructive">*</span>
          </Label>
          <Input
            id="pl-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Shanghái → Manzanillo 40'HC"
            maxLength={80}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">Mínimo 3 caracteres.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="pl-desc">Descripción</Label>
          <Textarea
            id="pl-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            placeholder="Opcional — cuándo usar esta plantilla"
            rows={2}
            maxLength={200}
          />
        </div>
      </FormDialogSection>

      <FormDialogSection title="Visibilidad" flat>
        <RadioGroup value={visibilidad} onValueChange={(v) => setVisibilidad(v as PlantillaVisibilidad)}>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="yo" id="vis-yo" className="mt-1" />
            <Label htmlFor="vis-yo" className="font-normal cursor-pointer">
              <span className="font-medium">Sólo yo</span>
              <span className="block text-xs text-muted-foreground">Sólo tú verás esta plantilla.</span>
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="org" id="vis-org" className="mt-1" />
            <Label htmlFor="vis-org" className="font-normal cursor-pointer">
              <span className="font-medium">Toda la organización</span>
              <span className="block text-xs text-muted-foreground">Todo el equipo podrá usarla.</span>
            </Label>
          </div>
        </RadioGroup>
      </FormDialogSection>
    </FormDialogShell>
  );
}
