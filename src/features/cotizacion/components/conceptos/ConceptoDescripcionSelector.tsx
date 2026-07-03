/**
 * ConceptoDescripcionSelector — Combobox estricto del catálogo de productos.
 *
 * Antes: hardcoded `CONCEPTOS_COSTO_USD` con escape hatch de texto libre.
 * Ahora: solo permite productos activos del catálogo maestro
 * (`catalogo_claves_sat`). Al elegir, autocompleta descripción, tasa de IVA
 * y flag `aplica_iva` según el `tipo_iva` del producto.
 */
import { ProductoServicioSelect } from "./ProductoServicioSelect";
import { tasaDesdeTipoIva } from "@/features/cotizacion/hooks/useProductosCatalogo";

interface Props {
  descripcion: string;
  index: number;
  actualizar: (index: number, campo: string, valor: string | number | boolean) => void;
}

export function ConceptoDescripcionSelector({ descripcion, index, actualizar }: Props) {
  return (
    <ProductoServicioSelect
      value={descripcion}
      onSelect={(p) => {
        const tasa = tasaDesdeTipoIva(p.tipo_iva);
        actualizar(index, "descripcion", p.nombre);
        actualizar(index, "aplica_iva", p.tipo_iva === "gravado_16");
        actualizar(index, "tasa_iva_aplicada", tasa);
        if (p.clave_unidad_sat) {
          actualizar(index, "unidad_medida", p.clave_unidad_sat);
        }
      }}
    />
  );
}
