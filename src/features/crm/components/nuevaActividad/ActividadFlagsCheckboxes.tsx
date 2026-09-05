/**
 * Casillas de calificación de la actividad (contacto efectivo / reunión
 * calificada). Extraído de `NuevaActividadDialog` para mantenerlo compacto.
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface Props {
  contactoEfectivo: boolean;
  onContactoEfectivo: (v: boolean) => void;
  reunionCalificada: boolean;
  onReunionCalificada: (v: boolean) => void;
}

export default function ActividadFlagsCheckboxes({
  contactoEfectivo, onContactoEfectivo, reunionCalificada, onReunionCalificada,
}: Props) {
  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="flex items-center gap-2">
        <Checkbox
          id="act-contacto-efectivo"
          checked={contactoEfectivo}
          onCheckedChange={(v) => onContactoEfectivo(v === true)}
        />
        <Label size="sm" htmlFor="act-contacto-efectivo" className="cursor-pointer">
          Contacto efectivo (hablé con quien decide)
        </Label>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="act-reunion-calificada"
          checked={reunionCalificada}
          onCheckedChange={(v) => onReunionCalificada(v === true)}
        />
        <Label size="sm" htmlFor="act-reunion-calificada" className="cursor-pointer">
          Reunión calificada (con necesidad y presupuesto)
        </Label>
      </div>
    </div>
  );
}
