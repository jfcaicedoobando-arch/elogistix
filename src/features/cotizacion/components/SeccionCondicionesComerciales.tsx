/**
 * v13.47.2 — Sección "Condiciones comerciales" del Paso 1 (sólo marítimo).
 *
 * Se renderiza DESPUÉS de TarifaVinculadaPanel porque sus campos dependen
 * de la tarifa elegida:
 *   - Ruta del barco (rutaTexto): se autollena con "origen → destino" al
 *     aplicar tarifa; editable por el comercial si lo necesita.
 *   - Validez de la propuesta: limitada por `tarifa.vigente_hasta`.
 *   - Seguro + valor de mercancía.
 *
 * Sin tarifa vinculada, los campos quedan deshabilitados con un hint.
 */
import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Lock } from "lucide-react";
import { WizardSection } from "@/components/shared/WizardSection";
import { FormField } from "@/components/shared/FormField";
import SeguroBlock from "./seccionRuta/SeguroBlock";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";
import { useTarifaVinculada } from "@/features/cotizacion/hooks/useTarifaVinculada";

function parseVigenteHasta(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 23, 59, 59, 999);
}

export default function SeccionCondicionesComerciales({ complete }: { complete?: boolean } = {}) {
  const ctx = useFormContext<CotizacionFormValues>();
  const { watch, setValue } = ctx;

  const tarifaId = watch("tarifaId");
  const validezPropuesta = watch("validezPropuesta");
  const seguro = watch("seguro");
  const rutaTexto = watch("rutaTexto");
  const tipoEmbarque = watch("tipoEmbarque");

  // v13.299.2: en LCL no hay tarifa vinculada (el flete se captura manual),
  // así que las condiciones comerciales deben quedar habilitadas de todos modos.
  const esLcl = tipoEmbarque === "LCL";
  const tieneTarifa = !!tarifaId;
  const camposHabilitados = tieneTarifa || esLcl;
  const [openValidez, setOpenValidez] = useState(false);
  const { data: tarifaVinc } = useTarifaVinculada(tarifaId);
  const tarifaHasta = useMemo(
    () => parseVigenteHasta(tarifaVinc?.vigente_hasta ?? null),
    [tarifaVinc?.vigente_hasta],
  );

  // Clamping de validez si excede vigencia de tarifa (heredado de SeccionRutaCotizacion).
  useEffect(() => {
    if (!tarifaHasta || !validezPropuesta) return;
    if (validezPropuesta > tarifaHasta) {
      setValue("validezPropuesta", tarifaHasta, { shouldValidate: true, shouldDirty: true });
    }
  }, [tarifaHasta, validezPropuesta, setValue]);

  const hoy = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  return (
    <WizardSection title="Condiciones comerciales" complete={complete}>
      {!camposHabilitados && (
        <div className="flex items-start gap-2 rounded-md border border-muted bg-muted/30 p-3 text-sm text-muted-foreground">
          <Lock className="size-4 mt-0.5 shrink-0" />
          <span>
            Selecciona una tarifa para definir la ruta del barco, la validez de la propuesta y el seguro.
          </span>
        </div>
      )}

      <div
        className={cn(
          "grid grid-cols-1 md:grid-cols-2 gap-4",
          !camposHabilitados && "opacity-60 pointer-events-none",
        )}
      >
        <FormField label="Ruta del barco" span={2}>
          <Input
            value={rutaTexto}
            onChange={(e) => setValue("rutaTexto", e.target.value, { shouldValidate: true, shouldDirty: true })}
            placeholder="Ej. Shanghai → Manzanillo (directo)"
            disabled={!camposHabilitados}
          />
          {tieneTarifa && (
            <p className="text-xs text-muted-foreground mt-1">
              Sugerida desde la tarifa. Puedes editarla si el agente confirma escalas.
            </p>
          )}
        </FormField>

        <FormField label="Validez de la propuesta">
          <Popover open={openValidez} onOpenChange={setOpenValidez}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={!camposHabilitados}
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !validezPropuesta && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {validezPropuesta ? format(validezPropuesta, "dd/MM/yyyy") : PLACEHOLDER_FECHA}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={validezPropuesta}
                onSelect={(d) => {
                  setValue("validezPropuesta", d, { shouldValidate: true, shouldDirty: true });
                  if (d) setOpenValidez(false);
                }}
                disabled={(date) => date < hoy || (!!tarifaHasta && date > tarifaHasta)}
                autoFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {tarifaHasta && (
            <p className="text-xs text-muted-foreground mt-1">
              Máximo {format(tarifaHasta, "dd/MM/yyyy")} según la tarifa vinculada.
            </p>
          )}
        </FormField>

        <SeguroBlock ctx={ctx} seguro={seguro} />
      </div>
    </WizardSection>
  );
}
