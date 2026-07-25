/**
 * Combobox de proveedor reutilizable (CxP). Lista alfabéticamente todos los
 * proveedores activos de la organización; búsqueda local.
 */
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useProveedoresLite } from "@/features/proveedor/hooks";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  /**
   * v13.315.8 (QW2) — el 3er argumento propaga `dias_credito` del proveedor
   * para que el consumidor pueda prellenar la fecha de vencimiento.
   */
  onChange: (id: string, nombre: string, diasCredito?: number) => void;
  placeholder?: string;
  className?: string;
}

export function ProveedorCombobox({ value, onChange, placeholder = "Selecciona proveedor", className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useProveedoresLite();
  const selected = items.find((i) => i.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline" role="combobox"
          className={cn("justify-between font-normal", className)}
        >
          {selected ? selected.nombre : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar proveedor…" />
          <CommandList
            className="overscroll-contain"
            onWheel={(e) => e.stopPropagation()}
          >
            <CommandEmpty>Sin resultados.</CommandEmpty>
            <CommandGroup>
              {items.map((i) => (
                <CommandItem
                  key={i.id}
                  value={i.nombre}
                  onSelect={() => {
                    onChange(i.id, i.nombre, i.dias_credito);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === i.id ? "opacity-100" : "opacity-0")} />
                  {i.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
