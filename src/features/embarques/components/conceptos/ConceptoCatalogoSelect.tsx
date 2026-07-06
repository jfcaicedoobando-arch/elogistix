/**
 * ConceptoCatalogoSelect — Combobox estricto para renglones de conceptos
 * de embarque (costos y ventas).
 *
 * Reutiliza `ProductoServicioSelect` (catálogo `catalogo_claves_sat`), pero
 * a diferencia de cotización sólo emite el `nombre` del producto: los
 * renglones de embarque no persisten clave SAT/tasa IVA aquí — eso viaja
 * cuando se convierte a factura.
 */
import { ProductoServicioSelect } from "@/features/cotizacion/components/conceptos/ProductoServicioSelect";

interface Props {
  value: string;
  onChange: (nombre: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ConceptoCatalogoSelect({ value, onChange, disabled, placeholder }: Props) {
  return (
    <ProductoServicioSelect
      value={value}
      disabled={disabled}
      placeholder={placeholder ?? "Selecciona concepto"}
      onSelect={(p) => onChange(p.nombre)}
    />
  );
}
