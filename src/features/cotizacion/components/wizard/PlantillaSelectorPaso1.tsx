/**
 * Selector "Empezar desde plantilla…" para el paso 1 del wizard (P2 — v13.295.0).
 *
 * Muestra un combobox con las plantillas más usadas del tenant.
 * Al seleccionar aplica el payload con `form.reset()` + `trigger()`.
 */
import { useState } from "react";
import { notifySuccess } from "@/lib/ui/appFeedback";
import { notifyError } from "@/lib/ui/appFeedback";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronsUpDown, Sparkles, Loader2 } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import {
  useCotizacionPlantillas,
  useAplicarPlantilla,
} from "@/features/cotizacion/hooks/useCotizacionPlantillas";
import type { CotizacionFormValues } from "@/features/cotizacion/domain/mappers/cotizacionForm";

interface Props {
  organizationId: string | null;
  form: UseFormReturn<CotizacionFormValues>;
  /** Se llama después de aplicar la plantilla — típicamente para saltar al paso 2. */
  onApplied?: () => void;
}

export function PlantillaSelectorPaso1({ organizationId, form, onApplied }: Props) {
  const [open, setOpen] = useState(false);
  const { data: plantillas = [], isLoading } = useCotizacionPlantillas(organizationId);
  const aplicar = useAplicarPlantilla();

  if (!organizationId) return null;
  if (!isLoading && plantillas.length === 0) return null;

  const handleAplicar = async (plantillaId: string, nombre: string) => {
    try {
      const payload = await aplicar.mutateAsync(plantillaId);
      if (payload?.values) {
        // Merge: mantiene los defaults del form y sobreescribe con la plantilla.
        const current = form.getValues();
        form.reset({ ...current, ...payload.values }, { keepDefaultValues: true });
        await form.trigger();
      }
      setOpen(false);
      notifySuccess(undefined, { title: `Plantilla "${nombre}" aplicada` });
      onApplied?.();
    } catch (err) {
      notifyError(undefined, {
        title: "No se pudo aplicar la plantilla",
        error: err,
        method: "PlantillaSelectorPaso1.aplicar",
      });
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4">
      <div className="flex items-center gap-3 rounded-lg border border-dashed bg-muted/30 px-4 py-2.5">
        <Sparkles className="h-4 w-4 text-primary shrink-0" aria-hidden />
        <div className="flex-1 text-sm">
          <span className="font-medium">¿Ruta frecuente?</span>{" "}
          <span className="text-muted-foreground">
            Empieza desde una plantilla guardada.
          </span>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" disabled={aplicar.isPending}>
              {aplicar.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Elegir plantilla
              <ChevronsUpDown className="h-3.5 w-3.5 ml-1 opacity-60" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-[360px] p-0">
            <Command>
              <CommandInput placeholder="Buscar plantilla…" />
              <CommandList>
                <CommandEmpty>Sin plantillas.</CommandEmpty>
                <CommandGroup heading="Más usadas">
                  {plantillas.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`${p.nombre} ${p.descripcion ?? ""}`}
                      onSelect={() => handleAplicar(p.id, p.nombre)}
                    >
                      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                        <span className="font-medium truncate">{p.nombre}</span>
                        {p.descripcion && (
                          <span className="text-xs text-muted-foreground truncate">
                            {p.descripcion}
                          </span>
                        )}
                      </div>
                      <span className="text-2xs text-muted-foreground shrink-0">
                        {p.veces_usada > 0 ? `${p.veces_usada}×` : "Nueva"}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
