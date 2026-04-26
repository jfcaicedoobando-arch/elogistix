import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { usePuertos } from "@/hooks/usePuertos";

interface PortSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

function formatPort(port: { code: string; name: string; country: string }) {
  return `${port.name}, ${port.country} (${port.code})`;
}

export default function PortSelect({ value, onValueChange, placeholder = "Seleccionar puerto" }: PortSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: ports = [] } = usePuertos();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between font-normal">
          {value ? <span className="truncate">{value}</span> : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar puerto, país o ciudad..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {search.trim() ? (
                <button
                  type="button"
                  className="w-full px-2 py-1.5 text-sm text-left hover:bg-accent rounded cursor-pointer"
                  onClick={() => { onValueChange(search.trim()); setSearch(""); setOpen(false); }}
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
                    onSelect={() => { onValueChange(display); setSearch(""); setOpen(false); }}
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
