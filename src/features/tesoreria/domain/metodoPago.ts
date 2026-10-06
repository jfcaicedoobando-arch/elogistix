/** Vocabulario compartido entre las filas del libro y su filtro semántico. */
import { FORMAS_PAGO_SAT, labelDeCatalogo } from "@/constants/catalogosSAT";

const ETIQUETAS: Record<string, string> = {
  "01": "Efectivo", "02": "Cheque", "03": "Transferencia",
  "04": "Tarjeta de crédito", "28": "Tarjeta de débito",
  "30": "Aplicación de anticipos", "99": "Por definir",
};

export function etiquetaMetodoPago(metodo: string | null): string {
  const valor = (metodo ?? "").trim();
  if (!valor) return "—";
  if (ETIQUETAS[valor]) return ETIQUETAS[valor];
  const literal = Object.values(ETIQUETAS).find((label) => label.localeCompare(valor, "es", { sensitivity: "base" }) === 0);
  if (literal) return literal;
  if (/^\d{2}$/.test(valor)) {
    return labelDeCatalogo(FORMAS_PAGO_SAT, valor, valor).replace(/^\d{2} - /, "");
  }
  return valor;
}
