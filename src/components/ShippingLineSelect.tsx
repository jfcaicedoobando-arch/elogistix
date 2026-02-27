import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { shippingLines } from "@/data/shippingLines";

interface ShippingLineSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export default function ShippingLineSelect({ value, onValueChange, placeholder = "Seleccionar naviera" }: ShippingLineSelectProps) {
  const [open, setOpen] = useState(false);

  const selected = shippingLines.find(s => s.code === value);
  const label = selected ? `${selected.name} (${selected.code})` : "";

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
          <CommandInput placeholder="Buscar naviera por nombre o código..." />
          <CommandList>
            <CommandEmpty>No se encontró la naviera.</CommandEmpty>
            <CommandGroup>
              {shippingLines.map(line => (
                <CommandItem
                  key={line.code}
                  value={`${line.name} ${line.code}`}
                  onSelect={() => { onValueChange(line.code); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === line.code ? "opacity-100" : "opacity-0")} />
                  {line.name} ({line.code})
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
