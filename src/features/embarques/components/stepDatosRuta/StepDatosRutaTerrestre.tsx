import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

const errClass = "text-xs text-destructive mt-1";

export function StepDatosRutaTerrestre({ errors }: { errors: StepValidationErrors }) {
  const { register } = useFormContext<EmbarqueFormValues>();
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="emb-ciudad-origen">Ciudad Origen *</Label>
        <Input id="emb-ciudad-origen" placeholder="Ej: Houston, TX" {...register('ciudadOrigen')} />
        {errors.ciudadOrigen && <p className={errClass}>{errors.ciudadOrigen}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="emb-ciudad-destino">Ciudad Destino *</Label>
        <Input id="emb-ciudad-destino" placeholder="Ej: León, Guanajuato" {...register('ciudadDestino')} />
        {errors.ciudadDestino && <p className={errClass}>{errors.ciudadDestino}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="emb-transportista">Transportista *</Label>
        <Input id="emb-transportista" {...register('transportista')} />
        {errors.transportista && <p className={errClass}>{errors.transportista}</p>}
      </div>
      <div className="space-y-2"><Label htmlFor="emb-carta-porte"># Carta Porte</Label><Input id="emb-carta-porte" {...register('cartaPorte')} /></div>
    </>
  );
}
