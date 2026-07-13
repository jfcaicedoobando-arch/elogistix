/**
 * Dialog para guardar la cotización actual como plantilla (P2 — v13.295.0).
 * Se invoca desde `CotizacionSuccessDialog` justo después de guardar.
 */
import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2 } from "lucide-react";
import { useGuardarPlantilla, type PlantillaVisibilidad } from "@/features/cotizacion/hooks/useCotizacionPlantillas";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string | null;
  usuarioId: string | null;
  /** Valores actuales del wizard. Se limpian antes de guardar (sin folios/fechas). */
  values: Partial<CotizacionFormValues>;
  onSaved?: () => void;
}

/**
 * Limpia el payload antes de persistirlo: elimina campos que se
 * regeneran al aplicar (folios, IDs, fechas de emisión, tarifa vinculada).
 */
function limpiarValues(values: Partial<CotizacionFormValues>): Partial<CotizacionFormValues> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const v: any = { ...values };
  delete v.id;
  delete v.folio;
  delete v.fecha_cotizacion;
  delete v.fecha_vencimiento;
  delete v.tarifa_id;
  delete v.tarifa_snapshot;
  return v as Partial<CotizacionFormValues>;
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
      toast.success("Plantilla guardada");
      onSaved?.();
      handleClose(false);
    } catch (err) {
      toast.error("No se pudo guardar la plantilla", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Guardar como plantilla</DialogTitle>
          <DialogDescription>
            Reutiliza esta cotización como base para cotizaciones futuras. Se
            guarda la ruta, cliente, incoterms y conceptos base (no folios ni fechas).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="pl-nombre">Nombre <span className="text-destructive">*</span></Label>
            <Input
              id="pl-nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Shanghái → Manzanillo 40'HC"
              maxLength={80}
              autoFocus
            />
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

          <div className="space-y-1.5">
            <Label>Visibilidad</Label>
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
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={guardar.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleGuardar} disabled={!puede || guardar.isPending}>
            {guardar.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Guardar plantilla
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
