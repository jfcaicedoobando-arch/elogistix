/**
 * Barrel raíz de Catálogos: superficie pública para otros features
 * (la frontera cross-feature de ESLint sólo permite este punto de entrada).
 */
export { PortIdSelect, etiquetaPuerto, filtrarPuertos } from "./components/PortIdSelect";
export type { PuertoOption } from "./components/PortIdSelect";
