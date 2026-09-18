import { Check } from "lucide-react";
import { CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { ProductoCatalogo } from "@/features/cotizacion/hooks/useProductosCatalogo";
import { TIPO_IVA_LABEL_CORTO } from "@/lib/financial/tipoIvaSat";
import { AVISO_IVA_FRONTERA_DESHABILITADO } from "@/lib/financial/ivaFrontera";
import { productoFronteraBloqueado } from "./productoFronteraBloqueado";

interface Props {
  productos: ProductoCatalogo[];
  seleccionadoId?: string;
  fronteraHabilitada: boolean;
  onSelect: (producto: ProductoCatalogo) => void;
}

export function ProductoServicioOptions({
  productos, seleccionadoId, fronteraHabilitada, onSelect,
}: Props) {
  return (
    <CommandGroup>
      {productos.map((producto) => {
        const bloqueado = productoFronteraBloqueado(producto, fronteraHabilitada);
        return (
          <CommandItem
            key={producto.id}
            value={producto.nombre}
            disabled={bloqueado}
            title={bloqueado ? AVISO_IVA_FRONTERA_DESHABILITADO : undefined}
            onSelect={() => {
              if (!bloqueado) onSelect(producto);
            }}
          >
            <Check className={cn(
              "mr-2 h-4 w-4",
              seleccionadoId === producto.id ? "opacity-100" : "opacity-0",
            )} />
            <div className="flex-1">
              <div className="font-medium">{producto.nombre}</div>
              <div className="text-label text-muted-foreground">
                SAT {producto.clave_sat} · {producto.clave_unidad_sat} ·{" "}
                {TIPO_IVA_LABEL_CORTO[producto.tipo_iva]}
              </div>
              {bloqueado && (
                <div className="text-label text-warning">Estímulo fronterizo deshabilitado</div>
              )}
            </div>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}