import { Plus, Edit, Trash2, RefreshCw, Upload, LogIn, Receipt, MessageSquare, FileX } from "lucide-react";
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
  factura: Receipt,
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
