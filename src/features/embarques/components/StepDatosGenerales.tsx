import { useFormContext } from "react-hook-form";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ValidationAlert } from "@/components/feedback/ValidationAlert";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";
import type { CotizacionRow } from "@/features/cotizacion/hooks";
import { useExpedientesCliente, type ExpedienteCliente } from "@/features/embarques/hooks";
// v13.303.26 — se removió `usePermissions`: la política tarifa-first exige cotización siempre.
import { BloqueClienteContactos } from "./secciones/BloqueClienteContactos";
import { BloqueMercancia } from "./secciones/BloqueMercancia";
import { BloqueVinculacion } from "./secciones/BloqueVinculacion";
import { ResumenHerenciaCotizacion } from "./secciones/ResumenHerenciaCotizacion";

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

;
import type { EmbarqueValidationErrors } from "@/features/embarques/types/embarque";

interface Props {
  clientes: Cliente[];
  clienteNombre: string;
  contactos: Contacto[];
  onMsdsUpload: (file: File) => void;
  errors?: EmbarqueValidationErrors;
  cotizacionesAceptadas?: CotizacionRow[];
  cotizacionVinculada?: CotizacionRow | null;
  onVincularCotizacion?: (cot: CotizacionRow) => void;
  onDesvincularCotizacion?: (opcion?: "limpiar" | "conservar" | "solo-conceptos") => void;
  modoExpediente?: 'nuevo' | 'existente';
  onModoExpedienteChange?: (modo: 'nuevo' | 'existente') => void;
  expedienteSeleccionado?: ExpedienteCliente | null;
  onSeleccionarExpediente?: (exp: ExpedienteCliente) => void;
  /** Cuando es false, se oculta el bloque de expediente (crear/asociar). Default: true. */
  mostrarSelectorExpediente?: boolean;
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
  mostrarSelectorExpediente = true,
}: Props) {
  const { watch } = useFormContext<EmbarqueFormValues>();
  const clienteId = watch('clienteId');
  const { data: expedientesCliente = [] } = useExpedientesCliente(clienteId || undefined);
  const requiereCotizacion = true;
  const faltaCotizacion = !cotizacionVinculada;


  const errorsRecord = errors as Record<string, string>;
  const hasErrors = Object.keys(errorsRecord).length > 0;

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle >Datos Generales</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {hasErrors && <ValidationAlert severity="error" errors={errorsRecord} />}
        {faltaCotizacion && (
          <Alert variant="warning">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Cotización requerida</AlertTitle>
            <AlertDescription>
              Tu rol requiere iniciar el embarque desde una cotización Aceptada. Selecciona una cotización en la sección inferior para continuar.
            </AlertDescription>
          </Alert>
        )}
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
          requiereCotizacion={requiereCotizacion}
          permiteExpediente={mostrarSelectorExpediente}
        />
        <BloqueClienteContactos
          clientes={clientes}
          clienteNombre={clienteNombre}
          contactos={contactos}
          errors={errors}
        />
        <BloqueMercancia errors={errors} onMsdsUpload={onMsdsUpload} />
        <ResumenHerenciaCotizacion />
      </CardContent>
    </Card>
  );
}
