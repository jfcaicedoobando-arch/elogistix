/**
 * Barrel del contenido de la página /ayuda.
 * Los datos viven en módulos hermanos para respetar el límite de 200 líneas
 * por archivo (Power of 10):
 *   - `ayudaTypes.ts`     → tipos (GlossaryTerm, FaqItem, AyudaModulo)
 *   - `ayudaGlosario.ts`  → GLOSARIO (51 términos)
 *   - `ayudaModulos.ts`   → MODULOS (12 módulos de FAQ)
 */
;
export { GLOSARIO } from "./ayudaGlosario";
export { MODULOS } from "./ayudaModulos";
