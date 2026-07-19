/**
 * ProductoServicioSelect — Combobox estricto para elegir un producto/servicio
 * del catálogo maestro de la organización.
 *
 * Uso: dentro de cada renglón de concepto de cotización (USD/MXN). Al elegir
 * un producto, el caller recibe el objeto completo para autocompletar
 * descripción, tipo de IVA y tasa aplicada.
 *
 * Modo estricto: no permite texto libre. Si el catálogo está vacío o el valor
 * actual no existe en el catálogo (concepto legacy), se muestra con estilo
 * `warning` y el usuario debe elegir una opción válida.
 */
import { useState } from "react";
import { Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useProductosCatalogo, type ProductoCatalogo } from "@/features/cotizacion/hooks/useProductosCatalogo";
import { useAuth } from "@/lib/contexts/AuthContext";

interface Props {
  value: string; // nombre actual guardado en la cotización
  onSelect: (producto: ProductoCatalogo) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ProductoServicioSelect({ value, onSelect, placeholder = "Selecciona producto", disabled }: Props) {
  const { organizationId } = useAuth();
  const { productos, isLoading, porNombre } = useProductosCatalogo(organizationId);
  const [open, setOpen] = useState(false);

  const seleccionado = value ? porNombre.get(value.toLowerCase()) : undefined;
  const esLegacy = !!value && !seleccionado;
  const vacio = !isLoading && productos.length === 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || isLoading}
          className={cn(
            "w-full justify-between font-normal",
            esLegacy && "border-warning text-warning-foreground",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate flex items-center gap-1">
            {esLegacy && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />}
            {value || placeholder}
          </span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar producto…" />
          <CommandList>
            {vacio ? (
              <div className="p-3 text-sm text-muted-foreground">
                No hay productos activos en el catálogo. Da de alta productos en{" "}
                <b>Configuración → Facturación → Catálogo de productos y servicios</b>.
              </div>
            ) : (
              <>
                <CommandEmpty>Sin coincidencias.</CommandEmpty>
                <CommandGroup>
                  {productos.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.nombre}
                      onSelect={() => {
                        onSelect(p);
                        setOpen(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          seleccionado?.id === p.id ? "opacity-100" : "opacity-0",
                        )}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{p.nombre}</div>
                        <div className="text-label text-muted-foreground">
                          SAT {p.clave_sat} · {p.clave_unidad_sat} ·{" "}
                          {p.tipo_iva === "gravado_16" ? "IVA 16%" : p.tipo_iva === "tasa_0" ? "IVA 0%" : "Exento"}
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
