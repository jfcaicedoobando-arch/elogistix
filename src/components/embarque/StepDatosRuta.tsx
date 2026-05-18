import { useEffect } from "react";
import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sugerirETA, type StepValidationErrors } from "@/lib/domain/embarqueWizardSchemas";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import type { EmbarqueFormValues } from "@/hooks/embarque";
import { StepDatosRutaMaritimo } from "./stepDatosRuta/StepDatosRutaMaritimo";
import { StepDatosRutaAereo } from "./stepDatosRuta/StepDatosRutaAereo";
import { StepDatosRutaTerrestre } from "./stepDatosRuta/StepDatosRutaTerrestre";
import { StepDatosRutaFechas } from "./stepDatosRuta/StepDatosRutaFechas";

interface Props {
  errors?: StepValidationErrors;
  /** Días de tránsito de la cotización vinculada (para sugerir ETA al elegir ETD). */
  diasTransitoSugerencia?: number | null;
}

export function StepDatosRuta({ errors = {}, diasTransitoSugerencia }: Props) {
  const { watch, setValue } = useFormContext<EmbarqueFormValues>();
  const modo = watch('modo');
  const etd = watch('etd');
  const eta = watch('eta');

  // Sugerir ETA cuando se ingresa ETD y hay días de tránsito de cotización
  useEffect(() => {
    if (etd && !eta && diasTransitoSugerencia && diasTransitoSugerencia > 0) {
      const sug = sugerirETA(etd, diasTransitoSugerencia);
      if (sug) setValue('eta', sug, { shouldDirty: true });
    }
  }, [etd, eta, diasTransitoSugerencia, setValue]);

  const hasErrors = Object.keys(errors).length > 0;
  const esMaritimo = modo === 'Marítimo' || !modo;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Datos de Ruta {modo && `— ${modo}`}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasErrors && <ValidationAlert severity="error" errors={errors} />}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {esMaritimo && <StepDatosRutaMaritimo errors={errors} />}
          {modo === 'Aéreo' && <StepDatosRutaAereo errors={errors} />}
          {modo === 'Terrestre' && <StepDatosRutaTerrestre errors={errors} />}
          <StepDatosRutaFechas errors={errors} diasTransitoSugerencia={diasTransitoSugerencia} />
        </div>
      </CardContent>
    </Card>
  );
}
