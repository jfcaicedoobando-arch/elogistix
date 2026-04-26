import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import type { EmbarqueFormValues } from "@/hooks/embarque/useEmbarqueForm";
import type { CotizacionRow } from "@/hooks/cotizacion/useCotizaciones";
import { useExpedientesCliente, type ExpedienteCliente } from "@/hooks/embarque/useEmbarques";
import { BloqueClienteContactos } from "./secciones/BloqueClienteContactos";
import { BloqueMercancia } from "./secciones/BloqueMercancia";
import { BloqueVinculacion } from "./secciones/BloqueVinculacion";

interface Contacto {
  id: string;
  nombre: string;
  tipo: string;
  pais: string;
}

interface Cliente {
  id: string;
  nombre: string;
}

export interface EmbarqueValidationErrors {
  modo?: string;
  tipo?: string;
  clienteId?: string;
  descripcionMercancia?: string;
}

interface Props {
  clientes: Cliente[];
  clienteNombre: string;
  contactos: Contacto[];
  onMsdsUpload: (file: File) => void;
  errors?: EmbarqueValidationErrors;
  cotizacionesAceptadas?: CotizacionRow[];
  cotizacionVinculada?: CotizacionRow | null;
  onVincularCotizacion?: (cot: CotizacionRow) => void;
  onDesvincularCotizacion?: () => void;
  modoExpediente?: 'nuevo' | 'existente';
  onModoExpedienteChange?: (modo: 'nuevo' | 'existente') => void;
  expedienteSeleccionado?: ExpedienteCliente | null;
  onSeleccionarExpediente?: (exp: ExpedienteCliente) => void;
}

export function StepDatosGenerales({
  clientes,
  clienteNombre,
  contactos,
  onMsdsUpload,
  errors = {},
  cotizacionesAceptadas = [],
  cotizacionVinculada,
  onVincularCotizacion,
  onDesvincularCotizacion,
  modoExpediente,
  onModoExpedienteChange,
  expedienteSeleccionado,
  onSeleccionarExpediente,
}: Props) {
  const { watch } = useFormContext<EmbarqueFormValues>();
  const clienteId = watch('clienteId');
  const { data: expedientesCliente = [] } = useExpedientesCliente(clienteId || undefined);

  const errorsRecord = errors as Record<string, string>;
  const hasErrors = Object.keys(errorsRecord).length > 0;

  return (
    <Card>
      <CardHeader><CardTitle>Datos Generales</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {hasErrors && <ValidationAlert severity="error" errors={errorsRecord} />}
        <BloqueVinculacion
          cotizacionesAceptadas={cotizacionesAceptadas}
          cotizacionVinculada={cotizacionVinculada}
          onVincularCotizacion={onVincularCotizacion}
          onDesvincularCotizacion={onDesvincularCotizacion}
          clienteId={clienteId || ''}
          expedientesCliente={expedientesCliente}
          modoExpediente={modoExpediente}
          onModoExpedienteChange={onModoExpedienteChange}
          expedienteSeleccionado={expedienteSeleccionado}
          onSeleccionarExpediente={onSeleccionarExpediente}
        />
        <BloqueClienteContactos
          clientes={clientes}
          clienteNombre={clienteNombre}
          contactos={contactos}
          errors={errors}
        />
        <BloqueMercancia errors={errors} onMsdsUpload={onMsdsUpload} />
      </CardContent>
    </Card>
  );
}
