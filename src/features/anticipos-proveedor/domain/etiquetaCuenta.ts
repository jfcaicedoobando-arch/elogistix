/** Etiqueta de cuenta bancaria sin repetir el banco (extraído para react-refresh). */
export interface CuentaOption {
  id: string;
  alias: string;
  banco: string;
  moneda: string;
}

/** Normaliza para comparar sin acentos ni mayúsculas. */
function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Etiqueta de cuenta sin repetir el banco: muchos alias ya lo incluyen
 * (alias "BASE USD" + banco "BASE" mostraba "BASE USD — BASE (USD)").
 */
export function etiquetaCuenta(c: CuentaOption) {
  const alias = (c.alias ?? "").trim();
  const banco = (c.banco ?? "").trim();
  if (!alias) return `${banco} (${c.moneda})`;
  if (!banco || normalizar(alias).includes(normalizar(banco))) {
    return `${alias} (${c.moneda})`;
  }
  return `${alias} — ${banco} (${c.moneda})`;
}
