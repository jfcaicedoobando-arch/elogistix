/**
 * NavieraSelect — combobox de navieras del catálogo compartido (Q-13).
 * Empty-state accionable: si no hay navieras activas, ofrece la CTA
 * "Crear naviera" en vez de un select vacío sin salida.
 */
import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useNavieras } from "@/features/catalogos/hooks/useNavieras";
import { NavieraFormDialog } from "@/components/shared/NavieraFormDialog";

interface Props {
  value: string | null;
  onSelect: (naviera: { id: string; name: string }) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function NavieraSelect({ value, onSelect, placeholder = "Selecciona naviera", disabled }: Props) {
  const { data: navieras = [], isLoading } = useNavieras();
  const [open, setOpen] = useState(false);
  const [creando, setCreando] = useState(false);

  const seleccionada = value ? navieras.find((n) => n.id === value) : undefined;
  const vacio = !isLoading && navieras.length === 0;

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || isLoading}
            className={cn("w-full justify-between font-normal", !seleccionada && "text-muted-foreground")}
          >
            <span className="truncate">{seleccionada?.name ?? placeholder}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            {!vacio && <CommandInput placeholder="Buscar naviera…" />}
            <CommandList>
              {vacio ? (
                <div className="p-3 space-y-2 text-sm text-muted-foreground" data-testid="naviera-select-empty">
                  No hay navieras activas en el catálogo.
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => { setOpen(false); setCreando(true); }}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear naviera
                  </Button>
                </div>
              ) : (
                <>
                  <CommandEmpty className="p-3 text-sm text-muted-foreground">Sin coincidencias.</CommandEmpty>
                  <CommandGroup>
                    {navieras.map((n) => (
                      <CommandItem key={n.id} value={n.name} onSelect={() => { onSelect(n); setOpen(false); }}>
                        <Check className={cn("mr-2 h-4 w-4", seleccionada?.id === n.id ? "opacity-100" : "opacity-0")} />
                        {n.name}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                  <div className="border-t p-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => { setOpen(false); setCreando(true); }}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear naviera
                    </Button>
                  </div>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <NavieraFormDialog
        open={creando}
        onOpenChange={setCreando}
        onGuardado={(n) => { if (n.id) onSelect({ id: n.id, name: n.name }); }}
      />
    </>
  );
}
