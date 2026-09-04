/**
 * Montos de las tablas de /crm/analitica.
 *
 * v13.823.78 — la tabla "Por vendedor" desbordaba su tarjeta en Desktop HD
 * (~449px de contenido en ~419px) y "Ponderado" quedaba truncado
 * ("MXN 37.5…"). Como estas tablas ya tienen una columna "Moneda", repetir el
 * código de moneda en cada importe era redundante: aquí se devuelve el número
 * compacto para mostrar y el valor completo (con moneda) para el `title` y el
 * texto accesible, de modo que no se pierde información.
 */
import { formatCurrencyCompact, formatCurrency } from "@/lib/formatters";

export interface MontoAnalitica {
  /** Texto visible, compacto y sin código de moneda. */
  texto: string;
  /** Valor completo con moneda, para tooltip y lectores de pantalla. */
  titulo: string;
}

export const montoAnalitica = (valor: number, moneda: string): MontoAnalitica => {
  const compacto = formatCurrencyCompact(valor, moneda);
  const prefijo = `${moneda} `;
  return {
    texto: compacto.startsWith(prefijo) ? compacto.slice(prefijo.length) : compacto,
    titulo: formatCurrency(valor, moneda),
  };
};
