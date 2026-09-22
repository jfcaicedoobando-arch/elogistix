/**
 * Barrel raíz de Catálogos: superficie pública para otros features
 * (la frontera cross-feature de ESLint sólo permite este punto de entrada).
 */
export { default as PortSelect } from "./components/PortSelect";
export { PortIdSelect } from "./components/PortIdSelect";
export { etiquetaPuerto, filtrarPuertos } from "./components/PortIdSelect.helpers";
export type { PuertoOption } from "./components/PortIdSelect.helpers";
