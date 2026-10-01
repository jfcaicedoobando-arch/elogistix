/**
 * Selector con búsqueda para ligar una Empresa o un Contacto existente.
 */
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useDebounce } from "@/hooks/shared";
import { useContactosCrm, useEmpresasCrm } from "@/features/crm/hooks/useObjetosCrm";

interface Props {
  objeto: "empresa" | "contacto";
  excluir: string[];
  onElegir: (id: string) => void;
  disabled?: boolean;
}

export function BuscadorObjetoCrm({ objeto, excluir, onElegir, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const term = useDebounce(texto, 300);
  const empresas = useEmpresasCrm(term, 0);
  const contactos = useContactosCrm(term, 0);
  const q = objeto === "empresa" ? empresas : contactos;
  const opciones = (q.data?.filas ?? []).filter((f) => !excluir.includes(f.id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Plus className="h-4 w-4" /> Ligar {objeto}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-72" align="end">
        <Command shouldFilter={false}>
          <CommandInput placeholder={`Buscar ${objeto}…`} value={texto} onValueChange={setTexto} />
          <CommandList>
            <CommandEmpty>{q.isFetching ? "Buscando…" : "Sin resultados"}</CommandEmpty>
            <CommandGroup>
              {opciones.map((o) => (
                <CommandItem
                  key={o.id}
                  value={o.id}
                  onSelect={() => { onElegir(o.id); setOpen(false); setTexto(""); }}
                >
                  {o.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
