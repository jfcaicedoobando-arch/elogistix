/**
 * Selector de proveedor al subir una factura al buzón CxP.
 * Prioriza los proveedores que ya aparecen en los costos del embarque y
 * permite buscar cualquier otro de la organización.
 */
import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
  useProveedoresDelEmbarque,
  useProveedoresForSelect,
} from "@/features/embarques/hooks/useEmbarqueQueries";

export interface ProveedorOpcion {
  id: string;
  nombre: string;
}

interface Props {
  embarqueId: string;
  seleccionado: ProveedorOpcion | null;
  detectadoId: string | null;
  onSeleccionar: (proveedor: ProveedorOpcion | null) => void;
}

function Fila({
  opcion,
  activo,
  detectado,
  onSeleccionar,
}: {
  opcion: ProveedorOpcion;
  activo: boolean;
  detectado: boolean;
  onSeleccionar: (p: ProveedorOpcion) => void;
}) {
  return (
    <CommandItem value={`${opcion.nombre} ${opcion.id}`} onSelect={() => onSeleccionar(opcion)}>
      <Check className={cn("mr-2 h-4 w-4", activo ? "opacity-100" : "opacity-0")} />
      <span className="truncate">{opcion.nombre}</span>
      {detectado && (
        <Badge variant="secondary" size="sm" className="ml-auto">
          Detectado del CFDI
        </Badge>
      )}
    </CommandItem>
  );
}

export function SelectorProveedorEntrante({
  embarqueId,
  seleccionado,
  detectadoId,
  onSeleccionar,
}: Props) {
  const [abierto, setAbierto] = useState(false);
  const { data: delEmbarque = [] } = useProveedoresDelEmbarque(embarqueId);
  const { data: todos = [] } = useProveedoresForSelect();

  const idsEmbarque = new Set(delEmbarque.map((p) => p.id));
  const resto = todos.filter((p) => !idsEmbarque.has(p.id));

  const elegir = (opcion: ProveedorOpcion | null) => {
    onSeleccionar(opcion);
    setAbierto(false);
  };

  return (
    <div className="space-y-2">
      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={abierto}
            className="w-full justify-between font-normal"
          >
            <span className={cn("truncate", !seleccionado && "text-muted-foreground")}>
              {seleccionado ? seleccionado.nombre : "Aún no lo sé / sin proveedor"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar proveedor…" />
            <CommandList>
              <CommandEmpty>No encontramos proveedores con ese nombre.</CommandEmpty>
              {delEmbarque.length > 0 && (
                <CommandGroup heading="Proveedores del embarque">
                  {delEmbarque.map((p) => (
                    <Fila
                      key={p.id}
                      opcion={p}
                      activo={seleccionado?.id === p.id}
                      detectado={detectadoId === p.id}
                      onSeleccionar={elegir}
                    />
                  ))}
                </CommandGroup>
              )}
              <CommandGroup heading="Todos los proveedores">
                {resto.map((p) => (
                  <Fila
                    key={p.id}
                    opcion={p}
                    activo={seleccionado?.id === p.id}
                    detectado={detectadoId === p.id}
                    onSeleccionar={elegir}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {seleccionado && (
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => elegir(null)}>
          <X className="mr-1 h-3.5 w-3.5" />
          Quitar proveedor
        </Button>
      )}
    </div>
  );
}
