/**
 * Selector (combobox) de puerto que recibe y devuelve el **ID** del puerto.
 * Distinto de `PortSelect`, que trabaja con texto libre y se usa en
 * Cotizaciones/Embarques. Aquí la ruta necesita IDs del catálogo.
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { usePuertos } from "@/features/catalogos/hooks";
import { etiquetaPuerto, filtrarPuertos, type PuertoOption } from "./PortIdSelect.helpers";

interface Props {
  value: string;
  onChange: (id: string) => void;
  /** Lista opcional; si se omite se usan los puertos activos del catálogo. */
  puertos?: PuertoOption[];
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  /** Puerto a excluir (por ejemplo el origen ya elegido). */
  excludeId?: string;
  "aria-invalid"?: boolean | undefined;
  className?: string;
}

export function PortIdSelect({
  value, onChange, puertos, placeholder = "Buscar puerto…", id, disabled,
  excludeId, "aria-invalid": ariaInvalid, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data: catalogo = [] } = usePuertos();
  const lista = puertos ?? (catalogo as PuertoOption[]);

  const disponibles = useMemo(
    () => lista
      .filter((p) => p.activo !== false && p.id !== excludeId)
      .slice()
      .sort((a, b) => etiquetaPuerto(a).localeCompare(etiquetaPuerto(b), "es", { sensitivity: "base" })),
    [lista, excludeId],
  );
  const visibles = useMemo(() => filtrarPuertos(disponibles, query), [disponibles, query]);
  const seleccionado = disponibles.find((p) => p.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={ariaInvalid}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !seleccionado && "text-muted-foreground",
            ariaInvalid && "border-destructive",
            className,
          )}
        >
          <span className="truncate">
            {seleccionado ? etiquetaPuerto(seleccionado) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar por nombre, país o código…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No se encontró el puerto.</CommandEmpty>
            <CommandGroup>
              {visibles.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => { onChange(p.id); setQuery(""); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  {etiquetaPuerto(p)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
