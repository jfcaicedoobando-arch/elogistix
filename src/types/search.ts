/**
 * Tipo de resultado de la búsqueda global (Ctrl+K).
 */

export interface GlobalSearchResult {
  id: string;
  label: string;
  sublabel?: string;
  type:
    | "embarque"
    | "cliente"
    | "proveedor"
    | "factura"
    | "factura_proveedor"
    | "cotizacion"
    | "proforma"
    | "pagina";
  url: string;
}
