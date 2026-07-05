import { Plus, Edit, Trash2, RefreshCw, Upload, LogIn, FileText, MessageSquare, FileX } from "lucide-react";

export const ICONOS_ACCION: Record<string, typeof Plus> = {
  crear: Plus,
  editar: Edit,
  editar_cliente: Edit,
  eliminar: Trash2,
  eliminar_documento: FileX,
  cambio_estado: RefreshCw,
  cambiar_estado: RefreshCw,
  subir_documento: Upload,
  login: LogIn,
  factura: FileText,
  agregar_nota: MessageSquare,
};

export const COLORES_ACCION: Record<string, string> = {
  crear: "bg-success/10 text-success",
  editar: "bg-info/10 text-info",
  editar_cliente: "bg-info/10 text-info",
  eliminar: "bg-destructive/10 text-destructive",
  eliminar_documento: "bg-destructive/10 text-destructive",
  cambio_estado: "bg-warning/10 text-warning",
  cambiar_estado: "bg-warning/10 text-warning",
  subir_documento: "bg-accent/10 text-accent",
  login: "bg-muted text-muted-foreground",
  factura: "bg-info/10 text-info",
  agregar_nota: "bg-accent/10 text-accent",
};

export const RUTAS_MODULO: Record<string, string> = {
  embarques: "/embarques",
  clientes: "/clientes",
  proveedores: "/compras/proveedores",
  facturas: "/facturacion",
  usuarios: "/usuarios",
  cotizaciones: "/cotizaciones",
};

export function tiempoRelativo(fecha: string): string {
  const ahora = Date.now();
  const diff = ahora - new Date(fecha).getTime();
  const minutos = Math.floor(diff / 60000);
  if (minutos < 1) return "hace un momento";
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas}h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `hace ${dias}d`;
  return new Date(fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}
