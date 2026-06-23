/**
 * Tipos del contenido estático de la página /ayuda.
 * Separado para mantener archivos ≤200 líneas (Power of 10).
 */

export interface GlossaryTerm {
  termino: string;
  definicion: string;
}

export interface FaqItem {
  pregunta: string;
  respuesta: string;
}

export interface AyudaModulo {
  id: string;
  titulo: string;
  resumen: string;
  /** Lectura humana (no enum) para evitar acoplar con AppRole. */
  audiencia?: string[];
  faqs: FaqItem[];
}
