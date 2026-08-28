/**
 * AgregarConceptoInline — botón único "Agregar concepto" (P2 cierre v13.296.0).
 *
 * Reemplaza los dos botones separados (USD/MXN) por un popover con:
 *  - Selector SAT (ProductoServicioSelect)
 *  - Toggle de moneda USD/MXN
 *  - Cantidad y precio unitario prefill
 *
 * Al aceptar, invoca `onAgregar(moneda, prefill)` — el hook padre calcula el
 * total con IVA con base en la tasa configurada.
 */
import { CANTIDAD_MAX } from "@/lib/validation/limitesNumericos";
import { useState } from "react";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProductoServicioSelect } from "@/features/cotizacion/components/conceptos/ProductoServicioSelect";
import type { ProductoCatalogo } from "@/features/cotizacion/hooks/useProductosCatalogo";
import { tasaDesdeTipoIva } from "@/features/cotizacion/hooks/useProductosCatalogo";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks/useCotizaciones";

interface Props {
  onAgregar: (moneda: "USD" | "MXN", prefill: Partial<ConceptoVentaCotizacion>) => void;
  monedaDefault?: "USD" | "MXN";
  /** Fija la moneda (oculta el toggle). */
  monedaFija?: "USD" | "MXN";
  variante?: "venta" | "costo";
  triggerLabel?: string;
}

export function AgregarConceptoInline({
  onAgregar,
  monedaDefault = "USD",
  monedaFija,
  variante = "venta",
  triggerLabel = "Agregar concepto",
}: Props) {
  const [open, setOpen] = useState(false);
  const [producto, setProducto] = useState<ProductoCatalogo | null>(null);
  const [moneda, setMoneda] = useState<"USD" | "MXN">(monedaFija ?? monedaDefault);
  const [cantidad, setCantidad] = useState(1);
  const [precio, setPrecio] = useState(0);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setProducto(null);
    setMoneda(monedaFija ?? monedaDefault);
    setCantidad(1);
    setPrecio(0);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    setOpen(o);
  };

  const puede = !!producto && cantidad > 0;

  const handleAceptar = () => {
    if (!puede || !producto) return;
    setSaving(true);
    try {
      const tasa = tasaDesdeTipoIva(producto.tipo_iva);
      onAgregar(moneda, {
        descripcion: producto.nombre,
        unidad_medida: producto.nombre_unidad ?? "",
        cantidad,
        precio_unitario: precio,
        aplica_iva: tasa > 0,
        tasa_iva_aplicada: tasa,
        moneda,
      });
      handleOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="agregar-concepto-inline">
          <Plus className="h-4 w-4 mr-1" /> {triggerLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-4 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-overline font-semibold">
            Producto / servicio
          </Label>
          <ProductoServicioSelect
            value={producto?.nombre ?? ""}
            onSelect={(p) => setProducto(p)}
            placeholder="Selecciona del catálogo SAT"
          />
        </div>

        {!monedaFija && (
          <div className="space-y-1.5">
            <Label className="text-overline font-semibold">
              Moneda
            </Label>
            <div className="inline-flex rounded-md border p-0.5">
              {(["USD", "MXN"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMoneda(m)}
                  className={
                    "px-3 py-1 text-body-sm rounded " +
                    (moneda === m
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted")
                  }
                  aria-pressed={moneda === m}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="aci-cant">Cantidad</Label>
            <Input
              id="aci-cant"
              type="number"
              min={1}
              max={CANTIDAD_MAX}
              step="0.01"
              value={cantidad}
              onChange={(e) => setCantidad(Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="aci-precio">
              Precio unitario {variante === "costo" ? "(costo)" : ""}
            </Label>
            <MoneyInput
              id="aci-precio"
              value={precio}
              onChange={(n: number) => setPrecio(n)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleAceptar} disabled={!puede} loading={saving}>
            Agregar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
