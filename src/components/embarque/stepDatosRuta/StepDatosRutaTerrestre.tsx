import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepValidationErrors } from "@/lib/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/hooks/embarque";

const errClass = "text-xs text-destructive mt-1";

export function StepDatosRutaTerrestre({ errors }: { errors: StepValidationErrors }) {
  const { register } = useFormContext<EmbarqueFormValues>();
  return (
    <>
      <div className="space-y-2">
        <Label>Ciudad Origen *</Label>
        <Input placeholder="Ej: Houston, TX" {...register('ciudadOrigen')} />
        {errors.ciudadOrigen && <p className={errClass}>{errors.ciudadOrigen}</p>}
      </div>
      <div className="space-y-2">
        <Label>Ciudad Destino *</Label>
        <Input placeholder="Ej: León, Guanajuato" {...register('ciudadDestino')} />
        {errors.ciudadDestino && <p className={errClass}>{errors.ciudadDestino}</p>}
      </div>
      <div className="space-y-2">
        <Label>Transportista *</Label>
        <Input {...register('transportista')} />
        {errors.transportista && <p className={errClass}>{errors.transportista}</p>}
      </div>
      <div className="space-y-2"><Label># Carta Porte</Label><Input {...register('cartaPorte')} /></div>
    </>
  );
}
