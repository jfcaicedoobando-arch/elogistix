/**
 * Selector múltiple de rutas CN → MX para captura masiva de tarifas.
 * Permite seleccionar varias rutas en un mismo modal de "Nueva tarifa".
 */
import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface RutaOption {
  id: string;
  activa: boolean;
  puerto_origen_nombre?: string;
  puerto_destino_nombre?: string;
}

interface Props {
  rutas: RutaOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  invalid?: boolean;
  id?: string;
}

const labelRuta = (r: RutaOption) =>
  `${r.puerto_origen_nombre ?? "?"} → ${r.puerto_destino_nombre ?? "?"}`;

export function MultiRutaSelect({ rutas, value, onChange, invalid, id }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const activas = useMemo(() => rutas.filter((r) => r.activa), [rutas]);
  const seleccion = useMemo(
    () => activas.filter((r) => value.includes(r.id)),
    [activas, value],
  );
  const visiblesFiltradas = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activas;
    return activas.filter((r) => labelRuta(r).toLowerCase().includes(q));
  }, [activas, query]);

  const toggle = (idRuta: string) => {
    if (value.includes(idRuta)) onChange(value.filter((v) => v !== idRuta));
    else onChange([...value, idRuta]);
  };
  const seleccionarVisibles = () => {
    const ids = new Set(value);
    for (const r of visiblesFiltradas) ids.add(r.id);
    onChange(Array.from(ids));
  };
  const limpiar = () => onChange([]);

  const triggerLabel = seleccion.length === 0
    ? "Selecciona una o varias rutas CN → MX"
    : seleccion.length === 1
      ? labelRuta(seleccion[0])
      : `${seleccion.length} rutas seleccionadas`;

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={invalid || undefined}
            className={cn(
              "w-full justify-between font-normal",
              seleccion.length === 0 && "text-muted-foreground",
              invalid && "border-destructive focus-visible:ring-destructive",
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[--radix-popover-trigger-width] p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
        >
          <Command shouldFilter={false}>
            <CommandInput
              placeholder="Buscar ruta…"
              value={query}
              onValueChange={setQuery}
            />
            <div className="flex items-center justify-between border-b px-2 py-1 text-xs text-muted-foreground">
              <button
                type="button"
                className="hover:text-foreground"
                onClick={seleccionarVisibles}
                disabled={visiblesFiltradas.length === 0}
              >
                Seleccionar todas las visibles
              </button>
              <button
                type="button"
                className="hover:text-foreground disabled:opacity-50"
                onClick={limpiar}
                disabled={value.length === 0}
              >
                Limpiar
              </button>
            </div>
            <CommandList onWheel={(e) => e.stopPropagation()}>
              <CommandEmpty>No hay rutas que coincidan.</CommandEmpty>
              <CommandGroup>
                {visiblesFiltradas.map((r) => {
                  const checked = value.includes(r.id);
                  return (
                    <CommandItem
                      key={r.id}
                      value={r.id}
                      onSelect={() => toggle(r.id)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", checked ? "opacity-100" : "opacity-0")} />
                      {labelRuta(r)}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {seleccion.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {seleccion.map((r) => (
            <Badge key={r.id} variant="secondary" className="gap-1 pr-1">
              <span>{labelRuta(r)}</span>
              <button
                type="button"
                aria-label={`Quitar ${labelRuta(r)}`}
                className="rounded-sm hover:bg-muted-foreground/20"
                onClick={() => toggle(r.id)}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
