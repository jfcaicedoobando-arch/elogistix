import { Link } from "react-router-dom";
import {
  Plus, Edit, Trash2, RefreshCw, Upload, LogIn, FileText, Activity,
  MessageSquare, FileX,
} from "lucide-react";
import type { EntradaBitacora } from "@/hooks/useBitacora";

const ICONOS_ACCION: Record<string, typeof Plus> = {
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

const COLORES_ACCION: Record<string, string> = {
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

const RUTAS_MODULO: Record<string, string> = {
  embarques: "/embarques",
  clientes: "/clientes",
  proveedores: "/proveedores",
  facturas: "/facturacion",
  usuarios: "/usuarios",
  cotizaciones: "/cotizaciones",
};

function tiempoRelativo(fecha: string): string {
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

interface Props {
  actividades: EntradaBitacora[];
  mostrarUsuario?: boolean;
}

export function BitacoraActividad({ actividades, mostrarUsuario = true }: Props) {
  if (actividades.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Sin actividad registrada
      </p>
    );
  }

  return (
    <div className="relative border-l-2 border-border ml-3 space-y-4 pl-6">
      {actividades.map((entrada) => {
        const Icono = ICONOS_ACCION[entrada.accion] ?? Activity;
        const colorClase = COLORES_ACCION[entrada.accion] ?? "bg-muted text-muted-foreground";
        const rutaModulo = RUTAS_MODULO[entrada.modulo];
        const linkEntidad =
          rutaModulo && entrada.entidad_id
            ? `${rutaModulo}/${entrada.entidad_id}`
            : undefined;

        return (
          <div key={entrada.id} className="relative">
            {/* Dot */}
            <div
              className={`absolute -left-[calc(1.5rem+5px)] top-1 flex h-5 w-5 items-center justify-center rounded-full ${colorClase}`}
            >
              <Icono className="h-3 w-3" />
            </div>

            <div className="space-y-0.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                {mostrarUsuario && (
                  <span className="text-xs font-medium text-foreground">
                    {entrada.usuario_email.split("@")[0]}
                  </span>
                )}
                <span className="text-xs text-muted-foreground capitalize">
                  {entrada.accion.replace(/_/g, " ")}
                </span>
                <span className="text-xs text-muted-foreground">en</span>
                <span className="text-xs font-medium text-foreground capitalize">
                  {entrada.modulo}
                </span>
                {entrada.entidad_nombre && (
                  <>
                    <span className="text-xs text-muted-foreground">—</span>
                    {linkEntidad ? (
                      <Link
                        to={linkEntidad}
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        {entrada.entidad_nombre}
                      </Link>
                    ) : (
                      <span className="text-xs font-medium">{entrada.entidad_nombre}</span>
                    )}
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{tiempoRelativo(entrada.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
