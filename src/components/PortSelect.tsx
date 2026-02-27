import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ports } from "@/data/ports";

interface PortSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export default function PortSelect({ value, onValueChange, placeholder = "Seleccionar puerto" }: PortSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = ports.find(p => p.code === value);
  const label = selected ? `${selected.name}, ${selected.country} (${selected.code})` : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {label || <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar puerto, país o código..." />
          <CommandList>
            <CommandEmpty>No se encontró el puerto.</CommandEmpty>
            <CommandGroup>
              {ports.map(port => {
                const display = `${port.name}, ${port.country} (${port.code})`;
                return (
                  <CommandItem
                    key={port.code}
                    value={`${port.name} ${port.country} ${port.code}`}
                    onSelect={() => { onValueChange(port.code); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === port.code ? "opacity-100" : "opacity-0")} />
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
