/**
 * v13.823.341 — Separación de notas internas y notas para el cliente.
 *
 * El campo `notas` de una cotización es un solo texto libre que históricamente
 * mezclaba recordatorios internos (pruebas de QA, avisos operativos) con el
 * texto que sí debe ver el cliente. Ese contenido interno terminaba en el
 * detalle, en el PDF y en el correo.
 *
 * Convención mínima (sin cambiar el esquema): un renglón es interno cuando
 * empieza con un marcador `[interno]`, `[internal]` o `#interno`, o cuando es
 * un residuo evidente de pruebas (`QA SMOKE`, `QA TEST`).
 */
const MARCADOR_INTERNO = /^\s*(?:\[\s*(?:interno|internal)\s*\]|#interno\b)\s*:?\s*/i;
const RESIDUO_QA = /^\s*qa\s*(?:smoke|test)\b/i;

export interface NotasSeparadas {
  /** Texto apto para el cliente (detalle, PDF y correo). */
  cliente: string;
  /** Texto de uso interno; nunca sale al cliente. */
  internas: string;
}

function esInterna(linea: string): boolean {
  return MARCADOR_INTERNO.test(linea) || RESIDUO_QA.test(linea);
}

/** Divide el texto de notas renglón por renglón en cliente / internas. */
export function separarNotas(texto: string | null | undefined): NotasSeparadas {
  if (!texto) return { cliente: "", internas: "" };
  const cliente: string[] = [];
  const internas: string[] = [];
  for (const linea of texto.split("\n")) {
    if (esInterna(linea)) internas.push(linea.replace(MARCADOR_INTERNO, "").trim());
    else cliente.push(linea);
  }
  return {
    cliente: cliente.join("\n").trim(),
    internas: internas.filter(Boolean).join("\n").trim(),
  };
}

/** Atajo para superficies de cliente (PDF, correo, portal). */
export function notasParaCliente(texto: string | null | undefined): string {
  return separarNotas(texto).cliente;
}
