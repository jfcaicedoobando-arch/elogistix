/**
 * Combobox de proveedor reutilizable (CxP). Lista alfabéticamente todos los
 * proveedores activos de la organización; búsqueda local.
 */
import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface Item { id: string; nombre: string }

async function fetchProveedoresLite(): Promise<Item[]> {
  const { data, error } = await supabase
    .from("proveedores")
    .select("id, nombre")
    .is("deleted_at", null)
    .order("nombre", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as Item[];
}

interface Props {
  value: string;
  onChange: (id: string, nombre: string) => void;
  placeholder?: string;
  className?: string;
}

export function ProveedorCombobox({ value, onChange, placeholder = "Selecciona proveedor", className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: items = [] } = useQuery({
    queryKey: ["proveedores", "lite"],
    queryFn: fetchProveedoresLite,
    staleTime: 5 * 60_000,
  });
  const selected = items.find((i) => i.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline" role="combobox"
          className={cn("justify-between font-normal", className)}
        >
          {selected ? selected.nombre : <span className="text-muted-foreground">{placeholder}</span>}
          <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start">
        <Command>
          <CommandInput placeholder="Buscar proveedor..." />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            <CommandGroup>
              {items.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.nombre}
                  onSelect={() => { onChange(p.id, p.nombre); setOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                  {p.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
