/**
 * ConceptoCatalogoSelect — Combobox estricto para renglones de conceptos
 * de embarque (costos y ventas).
 *
 * Reutiliza `ProductoServicioSelect` (catálogo `catalogo_claves_sat`) y emite
 * el `nombre` del producto. R179-01: opcionalmente emite también el
 * tratamiento fiscal del producto (`onSelectFiscal`) para las líneas de VENTA,
 * que sí lo persisten. Los renglones de costo siguen usando sólo el nombre.
 */
import { ProductoServicioSelect } from "@/features/cotizacion/components/conceptos/ProductoServicioSelect";
import { tasaDesdeTipoIva } from "@/features/cotizacion/hooks/useProductosCatalogo";

export interface FiscalCatalogo {
  aplicaIva: boolean;
  tasaIva: number;
}

interface Props {
  value: string;
  onChange: (nombre: string) => void;
  /** Tratamiento fiscal del producto elegido (sólo lo consumen las ventas). */
  onSelectFiscal?: (f: FiscalCatalogo) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ConceptoCatalogoSelect({ value, onChange, onSelectFiscal, disabled, placeholder }: Props) {
  return (
    <ProductoServicioSelect
      value={value}
      disabled={disabled}
      placeholder={placeholder ?? "Selecciona concepto"}
      onSelect={(p) => {
        onChange(p.nombre);
        if (onSelectFiscal) {
          const tasa = tasaDesdeTipoIva(p.tipo_iva);
          onSelectFiscal({ aplicaIva: tasa > 0, tasaIva: tasa });
        }
      }}
    />
  );
}
