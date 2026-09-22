import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { usePuertos } from "@/features/catalogos/hooks";

interface PortSelectProps {
  value: string;
  /**
   * Etapa 3: además del texto visible se emite el ID del puerto de catálogo
   * seleccionado (`null` cuando el usuario escribió texto libre). El segundo
   * argumento es opcional para los consumidores que sólo necesitan el texto.
   */
  onValueChange: (value: string, puertoId: string | null) => void;
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean | undefined;
  /** Etapa 5: accesibilidad e integración con Label/errores del formulario. */
  id?: string;
  "aria-describedby"?: string | undefined;
  disabled?: boolean;
  /** Etapa 5: puerto ya usado en el otro extremo de la ruta; no se lista. */
  excludeId?: string | null;
}


function formatPort(port: { code: string; name: string; country: string }) {
  return `${port.name}, ${port.country} (${port.code})`;
}

export default function PortSelect({
  value,
  onValueChange,
  placeholder = "Seleccionar puerto",
  className,
  "aria-invalid": ariaInvalid,
  id,
  "aria-describedby": ariaDescribedBy,
  disabled,
  excludeId,
}: PortSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: todos = [] } = usePuertos();
  const ports = excludeId ? todos.filter((p) => p.id !== excludeId) : todos;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          aria-describedby={ariaDescribedBy}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >

          {value ? <span className="truncate">{value}</span> : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar puerto, país o ciudad…" value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-sm text-left hover:bg-muted/50 rounded cursor-pointer"
                  onClick={() => { onValueChange(search.trim(), null); setSearch(""); setOpen(false); }}
                >
                  Usar "<span className="font-medium">{search.trim()}</span>"
                </button>
              ) : (
                "No se encontró el puerto."
              )}
            </CommandEmpty>
            <CommandGroup>
              {ports.map(port => {
                const display = formatPort(port);
                return (
                  <CommandItem
                    key={port.id}
                    value={`${port.name} ${port.country} ${port.code}`}
                    onSelect={() => { onValueChange(display, port.id); setSearch(""); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === display ? "opacity-100" : "opacity-0")} />
                    {display}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
