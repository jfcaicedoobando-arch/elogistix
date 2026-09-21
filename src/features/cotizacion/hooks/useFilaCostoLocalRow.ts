import { useState } from "react";
import { formatNumber } from "@/lib/formatters";
import { calcularUtilidad, calcularMargen } from "@/lib/financial/financialUtils";
import { tasaDesdeTipoIva } from "@/features/cotizacion/hooks/useProductosCatalogo";
import type { ProductoCatalogo } from "@/features/cotizacion/hooks/useProductosCatalogo";
import { parseCantidad, cantidadFueraDeRango } from "@/features/cotizacion/utils/parseInputNumero";
import { useNumericField } from "@/features/cotizacion/hooks/useNumericField";
import { filaCostoInvalida, filaSinProveedor } from "@/features/cotizacion/domain/cotizacionVentaSync";
import type { FilaCostoLocal } from "@/features/cotizacion/components/SeccionCostosInternosPLUnificado";

/** Formato de presentación de los campos de dinero (sin prefijo de moneda). */
export const formatoMonto = (n: number) => formatNumber(n, { decimals: 2 });

type OnUpdate = (globalIdx: number, field: keyof FilaCostoLocal, value: string | number | boolean) => void;

/**
 * Estado local, métricas derivadas y handlers fiscales de FilaCostoLocalRow.
 * Mantiene las reglas existentes: cantidad con parseCantidad/fallback 1,
 * dinero con 2 decimales al salir del campo, totales por cantidad, utilidad/
 * margen centralizados y la actualización fiscal del producto SAT con la
 * tasa calculada una sola vez por selección.
 */
export function useFilaCostoLocalRow(fila: FilaCostoLocal, gi: number, onUpdate: OnUpdate) {
  // R-01: los tres campos comparten el mismo patrón de edición local
  // (string crudo mientras hay foco, commit al salir del campo).
  const cantidadField = useNumericField(fila.cantidad, (n) => onUpdate(gi, "cantidad", n), {
    parse: parseCantidad,
    fallback: 1,
  });
  // v13.823.286 — los campos de dinero se leen con formato al salir del campo
  // (6100 → 6,100.00), igual que las columnas calculadas del mismo renglón.
  const costoField = useNumericField(fila.costo_unitario, (n) => onUpdate(gi, "costo_unitario", n), {
    formatDisplay: formatoMonto,
  });
  const ventaField = useNumericField(fila.precio_venta, (n) => onUpdate(gi, "precio_venta", n), {
    formatDisplay: formatoMonto,
  });

  const cantidadExcedida = cantidadFueraDeRango(fila.cantidad);
  const costoTotal = fila.cantidad * fila.costo_unitario;
  const ventaTotal = fila.cantidad * fila.precio_venta;
  const profit = calcularUtilidad(ventaTotal, costoTotal);
  const pct = calcularMargen(ventaTotal, costoTotal);

  // B-081: renglón con importes y sin concepto → se descartaría al generar la
  // venta y la cotización saldría en $0.00. Se marca y bloquea el avance.
  const conceptoFaltante = filaCostoInvalida(fila);
  // v13.823.305 (COT-2026-0245): un costo con importes y sin proveedor bloqueaba
  // después la creación del embarque; se pide aquí.
  const proveedorFaltante = filaSinProveedor(fila);

  // El campo de notas ya no vive abierto en cada renglón (hacía la tabla
  // altísima): se abre a demanda y queda abierto si la fila ya trae notas.
  const [notasAbiertas, setNotasAbiertas] = useState(false);
  // v13.823.286 — cerradas por defecto incluso si ya hay texto: el icono queda
  // resaltado como indicador y la lista deja de crecer de alto.
  const mostrarNotas = notasAbiertas;

  const handleProductoSelect = (p: ProductoCatalogo) => {
    onUpdate(gi, "concepto", p.nombre);
    onUpdate(gi, "clave_sat", p.clave_sat);
    onUpdate(gi, "concepto_libre", false);
    // El tratamiento fiscal explícito manda; la tasa es derivada.
    const tasa = tasaDesdeTipoIva(p.tipo_iva);
    onUpdate(gi, "tipo_iva", p.tipo_iva);
    onUpdate(gi, "aplica_iva", tasa > 0);
    onUpdate(gi, "tasa_iva_aplicada", tasa);
    // Sólo pre-llena unidad si la fila no tenía una elegida a mano.
    if (p.clave_unidad_sat && !fila.unidad_medida) {
      onUpdate(gi, "unidad_medida", p.clave_unidad_sat);
    }
  };

  const handleConceptoLibre = (texto: string) => {
    // Q-10/Q-12: concepto sin clave SAT — se marca `concepto_libre`
    // para que la fila sea válida sin bloquear el wizard; la clave
    // SAT se pedirá manualmente en el paso de facturación.
    onUpdate(gi, "concepto", texto);
    onUpdate(gi, "clave_sat", "");
    onUpdate(gi, "concepto_libre", true);
  };

  return {
    cantidadField,
    costoField,
    ventaField,
    cantidadExcedida,
    costoTotal,
    ventaTotal,
    profit,
    pct,
    conceptoFaltante,
    proveedorFaltante,
    mostrarNotas,
    toggleNotas: () => setNotasAbiertas((v) => !v),
    handleProductoSelect,
    handleConceptoLibre,
  };
}
