import { useFormContext, Controller } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/formatters/numbers";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PortSelect from "@/features/catalogos/components/PortSelect";
import {
  AgenteEmbarqueSelector,
  NavieraEmbarqueSelector,
} from "@/features/embarques/components/stepDatosRuta/AgenteNavieraHeredados";
import { ListaContenedoresEditable } from "@/features/embarques/components/contenedores/ListaContenedoresEditable";
import {
  conservarGeneralesEnContenedores,
  requiereConservarGenerales,
} from "@/features/embarques/domain/semillaContenedor";
import type { StepValidationErrors } from "@/features/embarques/domain/embarqueWizardSchemas";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";

const errClass = "text-body-sm text-destructive mt-1";

interface Props {
  errors: StepValidationErrors;
  /** IDs originales heredados desde la cotización (para badge/restaurar). */
  cotizacionAgenteId?: string | null;
  cotizacionNavieraId?: string | null;
}

/** Filtra errores de filas de contenedores para no duplicar mensajes. */
function filaErrores(errors: StepValidationErrors, index: number): string[] {
  const out: string[] = [];
  const numero = errors[`contenedores.${index}.numero_contenedor`];
  const tipo = errors[`contenedores.${index}.tipo_contenedor`];
  if (numero) out.push(numero);
  if (tipo) out.push(tipo);
  return out;
}

export function StepDatosRutaMaritimo({ errors, cotizacionAgenteId, cotizacionNavieraId }: Props) {
  const { register, watch, setValue } = useFormContext<EmbarqueFormValues>();
  const tipoServicio = watch('tipoServicio');
  const contenedores = watch('contenedores') ?? [];
  const generales = {
    pesoKg: watch('pesoKg'),
    volumenM3: watch('volumenM3'),
    piezas: watch('piezas'),
  };

  const aplicarConservacion = (filas: typeof contenedores) => {
    setValue('contenedores', conservarGeneralesEnContenedores(filas, generales), {
      shouldValidate: true,
      shouldDirty: true,
    });
  };

  const handleTipoServicioChange = (v: string) => {
    setValue('tipoServicio', v, { shouldValidate: true, shouldDirty: true });
    if (v === 'LCL') {
      setValue('tipoContenedor', 'LCL', { shouldValidate: true, shouldDirty: true });
      setValue('contenedores', [], { shouldValidate: true, shouldDirty: true });
    } else if (v === 'FCL') {
      // B4: en FCL los totales se derivan de los contenedores. Se conservan las
      // cantidades ya capturadas en Datos generales pasándolas a la primera
      // fila, tanto si aún no hay filas como si el operador agregó la fila
      // antes de elegir FCL (sin acumular ni pisar cantidades reales).
      aplicarConservacion(contenedores);
    }
  };

  // Borradores reabiertos ya en FCL con filas en cero: se avisa y el operador
  // decide (nunca se repone en automático, para respetar el cero explícito).
  const mostrarAvisoConservar =
    tipoServicio === 'FCL' && requiereConservarGenerales(contenedores, generales);

  return (
    <>
      <div className="space-y-2">
        <Label>Puerto Origen *</Label>
        <Controller name="puertoOrigen" render={({ field }) => (
          <PortSelect
            value={field.value}
            onValueChange={field.onChange}
            placeholder="Seleccionar puerto origen"
            className={cn(errors.puertoOrigen && 'border-destructive')}
            aria-invalid={errors.puertoOrigen ? true : undefined}
          />
        )} />
        {errors.puertoOrigen && <p className={errClass}>{errors.puertoOrigen}</p>}
      </div>
      <div className="space-y-2">
        <Label>Puerto Destino *</Label>
        <Controller name="puertoDestino" render={({ field }) => (
          <PortSelect
            value={field.value}
            onValueChange={field.onChange}
            placeholder="Seleccionar puerto destino"
            className={cn(errors.puertoDestino && 'border-destructive')}
            aria-invalid={errors.puertoDestino ? true : undefined}
          />
        )} />
        {errors.puertoDestino && <p className={errClass}>{errors.puertoDestino}</p>}
      </div>
      <NavieraEmbarqueSelector cotizacionNavieraId={cotizacionNavieraId} />
      <AgenteEmbarqueSelector cotizacionAgenteId={cotizacionAgenteId} />
      <div className="space-y-2"><Label htmlFor="emb-bl-master"># BL Master</Label><Input id="emb-bl-master" placeholder="Número de BL" {...register('blMaster')} /></div>
      <div className="space-y-2"><Label htmlFor="emb-bl-house"># BL House</Label><Input id="emb-bl-house" {...register('blHouse')} /></div>
      <div className="space-y-2">
        <Label>Tipo de Servicio *</Label>
        <Controller name="tipoServicio" render={({ field }) => (
          <Select value={field.value} onValueChange={handleTipoServicioChange}>
            <SelectTrigger
              aria-invalid={errors.tipoServicio ? true : undefined}
              className={cn(errors.tipoServicio && 'border-destructive')}
            >
              <SelectValue placeholder="FCL / LCL" />
            </SelectTrigger>
            <SelectContent><SelectItem value="FCL">FCL</SelectItem><SelectItem value="LCL">LCL</SelectItem></SelectContent>
          </Select>
        )} />
        {errors.tipoServicio && <p className={errClass}>{errors.tipoServicio}</p>}
      </div>

      <div className="space-y-2 md:col-span-2">
        <Label>Contenedores *</Label>
        {tipoServicio === 'LCL' ? (
          <Input aria-label="Contenedores" value="LCL (Carga Consolidada) — se asigna automáticamente" disabled />
        ) : (
          <>
            {mostrarAvisoConservar && (
              <Alert variant="warning">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Las cantidades quedarían en cero</AlertTitle>
                <AlertDescription className="space-y-2">
                  <p>
                    En FCL el peso, volumen y piezas se toman de los contenedores, y ninguna
                    fila tiene cantidades. Se capturaron{" "}
                    {formatNumber(Number(generales.pesoKg) || 0)} kg,{" "}
                    {formatNumber(Number(generales.volumenM3) || 0)} m³ y{" "}
                    {formatNumber(Number(generales.piezas) || 0)} piezas en Datos generales.
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => aplicarConservacion(contenedores)}
                  >
                    Pasar las cantidades al primer contenedor
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            <Controller
              name="contenedores"
              render={({ field }) => (
                <ListaContenedoresEditable
                  value={field.value ?? []}
                  onChange={field.onChange}
                  minRows={1}
                />
              )}
            />
            {errors.contenedores && <p className={errClass}>{errors.contenedores}</p>}
            {(contenedores ?? []).map((_, i) => {
              const msgs = filaErrores(errors, i);
              if (msgs.length === 0) return null;
              return (
                <p key={`err-${i}`} className={errClass}>
                  Contenedor #{i + 1}: {msgs.join(" · ")}
                </p>
              );
            })}
          </>
        )}
      </div>
    </>
  );
}
