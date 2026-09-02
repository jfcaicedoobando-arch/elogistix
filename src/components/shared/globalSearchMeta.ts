/**
 * Constantes de presentación del buscador global (iconos, etiquetas y clases).
 * Viven en un módulo aparte para no romper el Fast Refresh del archivo de
 * componentes (`GlobalSearch.partes.tsx`).
 */
import { Ship, Users, Truck, FileSpreadsheet, ClipboardList, Receipt, Compass } from "lucide-react";

/**
 * Icono de la fila: gris apagado en reposo y azul de acento cuando la fila está
 * seleccionada, para reforzar la selección sin fondo sólido.
 */
export const ICONO_FILA =
  "mr-1 h-4 w-4 shrink-0 text-muted-foreground group-data-[selected=true]:text-accent";

export const typeIcons = {
  embarque: Ship,
  cliente: Users,
  proveedor: Truck,
  factura: Receipt,
  factura_proveedor: Receipt,
  cotizacion: ClipboardList,
  proforma: FileSpreadsheet,
  pagina: Compass,
};

export const typeLabels = {
  embarque: "Embarques",
  cliente: "Clientes",
  proveedor: "Proveedores",
  factura: "Facturas",
  factura_proveedor: "Facturas de proveedor",
  cotizacion: "Cotizaciones",
  proforma: "Proformas",
  pagina: "Páginas",
};
