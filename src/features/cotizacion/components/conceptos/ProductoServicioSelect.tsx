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
 *
 * Q-10 (Ola 4): dos escapes al modo estricto, ambos opt-in vía props:
 *  - `onConceptoLibre`: permite capturar un texto sin clave SAT (marcado
 *    `concepto_libre` por el caller — usado en costos internos).
 *  - CTA "Crear concepto": alta rápida sin salir del wizard.
 */
import { useState } from "react";
import { Check, ChevronsUpDown, AlertTriangle, PenLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useProductosCatalogo, type ProductoCatalogo } from "@/features/cotizacion/hooks/useProductosCatalogo";
import { useAuth } from "@/lib/contexts/AuthContext";
import { SALES, hasRole } from "@/lib/access/permissionMatrix";
import { CrearConceptoInlineForm } from "./CrearConceptoInlineForm";

interface Props {
  value: string; // nombre actual guardado en la cotización
  onSelect: (producto: ProductoCatalogo) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Q-10: si se provee, el combobox ofrece "usar como concepto libre" con el texto buscado. */
  onConceptoLibre?: (texto: string) => void;
}

export function ProductoServicioSelect({ value, onSelect, placeholder = "Selecciona producto", disabled, onConceptoLibre }: Props) {
  const { organizationId, role } = useAuth();
  // R-04: el catálogo SAT es maestro contable. Ventas/pricing lo consultan,
  // pero no dan de alta claves nuevas desde el wizard.
  const puedeCrearConcepto = !hasRole(SALES, role);
  const { productos, isLoading, porNombre } = useProductosCatalogo(organizationId);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creando, setCreando] = useState(false);

  const seleccionado = value ? porNombre.get(value.toLowerCase()) : undefined;
  const esLegacy = !!value && !seleccionado;
  const vacio = !isLoading && productos.length === 0;

  const cerrarYResetear = () => {
    setOpen(false);
    setCreando(false);
    setSearch("");
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setCreando(false); setSearch(""); } }}>
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
        {creando && organizationId ? (
          <CrearConceptoInlineForm
            organizationId={organizationId}
            nombreInicial={search}
            onCancel={() => setCreando(false)}
            onCreado={(p) => { onSelect(p); cerrarYResetear(); }}
          />
        ) : (
          <Command shouldFilter={!vacio}>
            <CommandInput placeholder="Buscar producto…" value={search} onValueChange={setSearch} />
            <CommandList>
              {vacio ? (
                <div className="p-3 text-sm text-muted-foreground">
                  No hay productos activos en el catálogo. Da de alta productos en{" "}
                  <b>Configuración → Facturación → Catálogo de productos y servicios</b> o usa el botón de abajo.
                </div>
              ) : (
                <>
                  <CommandEmpty className="p-0">
                    <div className="p-3 text-sm text-muted-foreground">Sin coincidencias.</div>
                  </CommandEmpty>
                  <CommandGroup>
                    {productos.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.nombre}
                        onSelect={() => { onSelect(p); cerrarYResetear(); }}
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
            <div className="border-t p-1 space-y-1">
              {onConceptoLibre && search.trim().length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => { onConceptoLibre(search.trim()); cerrarYResetear(); }}
                >
                  <PenLine className="h-3.5 w-3.5 mr-1.5" /> Usar "{search.trim()}" como concepto libre
                </Button>
              )}
              {organizationId && puedeCrearConcepto && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => setCreando(true)}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Crear concepto
                </Button>
              )}
            </div>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
