/**
 * Dialog de edición de plantilla — extraído de `CotizacionPlantillas.tsx` en
 * v13.297.4 para respetar el límite `max-lines`.
 */
import { useState } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import {
  useActualizarPlantilla,
  type CotizacionPlantilla,
  type PlantillaVisibilidad,
} from "@/features/cotizacion/hooks/useCotizacionPlantillas";

interface EditProps {
  plantilla: CotizacionPlantilla;
  organizationId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function EditarPlantillaDialog({ plantilla, organizationId, open, onOpenChange }: EditProps) {
  const [nombre, setNombre] = useState(plantilla.nombre);
  const [descripcion, setDescripcion] = useState(plantilla.descripcion ?? "");
  const [visibilidad, setVisibilidad] = useState<PlantillaVisibilidad>(plantilla.visibilidad);
  const actualizar = useActualizarPlantilla();

  const puede = !!organizationId && nombre.trim().length >= 3;

  const handleGuardar = async () => {
    if (!puede || !organizationId) return;
    try {
      await actualizar.mutateAsync({
        id: plantilla.id,
        organizationId,
        nombre,
        descripcion,
        visibilidad,
      });
      notifySuccess(undefined, { title: "Plantilla actualizada" });
      onOpenChange(false);
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo actualizar",
        error: err,
        method: "EditarPlantillaDialog.submit",
      });
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Pencil}
      title="Editar plantilla"
      description="Actualiza el nombre, la descripción o la visibilidad. El contenido de la cotización base se preserva."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={actualizar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={!puede || actualizar.isPending}>
            Guardar cambios
          </Button>
        </>
      }
    >
      <FormDialogSection title="Identificación" cols={1}>
        <div className="space-y-1.5">
          <Label htmlFor="ep-nombre">Nombre <span className="text-destructive">*</span></Label>
          <Input
            id="ep-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ep-desc">Descripción</Label>
          <Textarea
            id="ep-desc"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            rows={2}
            maxLength={200}
          />
        </div>
      </FormDialogSection>

      <FormDialogSection title="Visibilidad" flat>
        <RadioGroup value={visibilidad} onValueChange={(v) => setVisibilidad(v as PlantillaVisibilidad)}>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="yo" id="ep-vis-yo" className="mt-1" />
            <Label htmlFor="ep-vis-yo" className="font-normal cursor-pointer">
              <span className="font-medium">Sólo yo</span>
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="org" id="ep-vis-org" className="mt-1" />
            <Label htmlFor="ep-vis-org" className="font-normal cursor-pointer">
              <span className="font-medium">Toda la organización</span>
            </Label>
          </div>
        </RadioGroup>
      </FormDialogSection>
    </FormDialogShell>
  );
}
