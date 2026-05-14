import { Link } from "react-router-dom";
import {
  Plus, Edit, Trash2, RefreshCw, Upload, LogIn, FileText, Activity,
  MessageSquare, FileX, ArrowRight,
} from "lucide-react";
import type { EntradaBitacora } from "@/hooks/shared/useBitacora";
import { nombreDesdeEmail, formatDate } from "@/lib/formatters";
import { describirEntrada } from "@/lib/domain/bitacoraDescripcion";
import { getEstadoVisual } from "@/lib/ui/estadoConfig";

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

function EstadoBadge({ estado, atenuado = false }: { estado: string; atenuado?: boolean }) {
  const visual = getEstadoVisual(estado);
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${visual.badge} ${atenuado ? "opacity-60" : ""}`}
    >
      {estado}
    </span>
  );
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
    <div className="relative border-l-2 border-border ml-3 space-y-5 pl-6">
      {actividades.map((entrada) => {
        const Icono = ICONOS_ACCION[entrada.accion] ?? Activity;
        const colorClase = COLORES_ACCION[entrada.accion] ?? "bg-muted text-muted-foreground";
        const rutaModulo = RUTAS_MODULO[entrada.modulo];
        const linkEntidad =
          rutaModulo && entrada.entidad_id
            ? `${rutaModulo}/${entrada.entidad_id}`
            : undefined;
        const descripcion = describirEntrada(entrada);
        const esCambioEstado = !!(descripcion.estadoAnterior && descripcion.estadoNuevo);

        return (
          <div key={entrada.id} className="relative">
            <div
              className={`absolute -left-[calc(1.5rem+5px)] top-1 flex h-5 w-5 items-center justify-center rounded-full ${colorClase}`}
            >
              <Icono className="h-3 w-3" />
            </div>

            <div className="space-y-1">
              {/* Línea 1: usuario · tiempo */}
              <div className="flex items-baseline gap-2 flex-wrap">
                {mostrarUsuario && (
                  <span className="text-xs font-medium text-foreground" title={entrada.usuario_email}>
                    {nombreDesdeEmail(entrada.usuario_email)}
                  </span>
                )}
                <span
                  className="text-xs text-muted-foreground"
                  title={formatDate(entrada.created_at, "dd/MM/yyyy HH:mm")}
                >
                  {tiempoRelativo(entrada.created_at)}
                </span>
              </div>

              {/* Línea 2: título descriptivo */}
              {esCambioEstado ? (
                <div className="flex items-center gap-1.5 flex-wrap text-sm text-foreground">
                  <span>Cambió estado de</span>
                  <EstadoBadge estado={descripcion.estadoAnterior!} atenuado />
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  <EstadoBadge estado={descripcion.estadoNuevo!} />
                </div>
              ) : (
                <p className="text-sm text-foreground">{descripcion.titulo}</p>
              )}

              {descripcion.contexto && (
                <p className="text-xs text-muted-foreground">{descripcion.contexto}</p>
              )}

              {/* Línea 3: módulo + link a entidad */}
              <div className="flex items-baseline gap-1.5 flex-wrap text-xs text-muted-foreground">
                <span>en</span>
                <span className="capitalize">{entrada.modulo}</span>
                {entrada.entidad_nombre && (
                  <>
                    <span>—</span>
                    {linkEntidad ? (
                      <Link
                        to={linkEntidad}
                        className="font-medium text-accent hover:underline"
                      >
                        {entrada.entidad_nombre}
                      </Link>
                    ) : (
                      <span className="font-medium text-foreground">{entrada.entidad_nombre}</span>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
