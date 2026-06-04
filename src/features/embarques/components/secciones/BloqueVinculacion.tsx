import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import type { CotizacionRow } from "@/hooks/cotizacion";
import type { ExpedienteCliente } from "@/hooks/embarque";

interface Props {
  cotizacionesAceptadas: CotizacionRow[];
  cotizacionVinculada?: CotizacionRow | null;
  onVincularCotizacion?: (cot: CotizacionRow) => void;
  onDesvincularCotizacion?: () => void;
  clienteId: string;
  expedientesCliente: ExpedienteCliente[];
  modoExpediente?: 'nuevo' | 'existente';
  onModoExpedienteChange?: (modo: 'nuevo' | 'existente') => void;
  expedienteSeleccionado?: ExpedienteCliente | null;
  onSeleccionarExpediente?: (exp: ExpedienteCliente) => void;
}

export function BloqueVinculacion({
  cotizacionesAceptadas,
  cotizacionVinculada,
  onVincularCotizacion,
  onDesvincularCotizacion,
  clienteId,
  expedientesCliente,
  modoExpediente,
  onModoExpedienteChange,
  expedienteSeleccionado,
  onSeleccionarExpediente,
}: Props) {
  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [expedienteComboOpen, setExpedienteComboOpen] = useState(false);
  const tieneExpedientes = expedientesCliente.length > 0;

  return (
    <>
      <div className="space-y-2">
        <Label>¿Vincular a cotización existente? (opcional)</Label>
        {cotizacionVinculada ? (
          <div className="flex items-center gap-2">
            <Badge variant="success" className="px-3 py-1.5 text-sm">
              ✓ Vinculada a {cotizacionVinculada.folio} — {cotizacionVinculada.cliente_nombre}
            </Badge>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={onDesvincularCotizacion} aria-label="Desvincular cotización">
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={comboboxOpen} className="w-full justify-between font-normal text-muted-foreground">
                Buscar cotización aceptada...
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Buscar por folio o cliente..." />
                <CommandList>
                  <CommandEmpty>Sin cotizaciones aceptadas</CommandEmpty>
                  <CommandGroup>
                    {cotizacionesAceptadas.map((cot) => (
                      <CommandItem
                        key={cot.id}
                        value={`${cot.folio} ${cot.cliente_nombre}`}
                        onSelect={() => {
                          onVincularCotizacion?.(cot);
                          setComboboxOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", "opacity-0")} />
                        <span className="truncate">
                          {cot.folio} — {cot.cliente_nombre} ({cot.origen} → {cot.destino})
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {clienteId && tieneExpedientes && (
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <Label className="text-sm font-medium">Expediente</Label>
          <RadioGroup
            value={modoExpediente}
            onValueChange={(v) => onModoExpedienteChange?.(v as 'nuevo' | 'existente')}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="nuevo" id="exp-nuevo" />
              <Label htmlFor="exp-nuevo" className="font-normal cursor-pointer">Crear nuevo expediente</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="existente" id="exp-existente" />
              <Label htmlFor="exp-existente" className="font-normal cursor-pointer">Asociar a expediente existente</Label>
            </div>
          </RadioGroup>

          {modoExpediente === 'existente' && (
            <div className="space-y-2">
              {expedienteSeleccionado ? (
                <div className="flex items-center gap-2">
                  <Badge variant="info" className="px-3 py-1.5 text-sm">
                    📦 {expedienteSeleccionado.expediente}
                    {expedienteSeleccionado.bl_master && ` | BL: ${expedienteSeleccionado.bl_master}`}
                    {` (${expedienteSeleccionado.total_embarques} embarque${expedienteSeleccionado.total_embarques > 1 ? 's' : ''})`}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onModoExpedienteChange?.('nuevo')}
                    aria-label="Quitar expediente vinculado"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Popover open={expedienteComboOpen} onOpenChange={setExpedienteComboOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" aria-expanded={expedienteComboOpen} className="w-full justify-between font-normal text-muted-foreground">
                      Buscar expediente...
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar por expediente o BL..." />
                      <CommandList>
                        <CommandEmpty>Sin expedientes abiertos para este cliente</CommandEmpty>
                        <CommandGroup>
                          {expedientesCliente.map(exp => (
                            <CommandItem
                              key={exp.expediente}
                              value={`${exp.expediente} ${exp.bl_master || ''}`}
                              onSelect={() => {
                                onSeleccionarExpediente?.(exp);
                                setExpedienteComboOpen(false);
                              }}
                            >
                              <span className="truncate">
                                {exp.expediente}
                                {exp.bl_master && ` | BL: ${exp.bl_master}`}
                                <span className="text-muted-foreground ml-1">
                                  ({exp.total_embarques} emb.)
                                </span>
                              </span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
}
