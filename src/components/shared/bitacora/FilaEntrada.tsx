import { Link } from "react-router-dom";
import { Activity, ArrowRight } from "lucide-react";
import type { EntradaBitacora } from "@/hooks/shared";
import { nombreDesdeEmail, formatDate } from "@/lib/formatters";
import { describirEntrada } from "@/lib/domain/bitacoraDescripcion";
import { getEstadoVisual } from "@/lib/ui/estadoConfig";
import { humanizarEnum } from "@/lib/ui/enumLabels";
import { ICONOS_ACCION, COLORES_ACCION, RUTAS_MODULO } from "./constants";
import { formatRelativo } from "@/lib/date/relativo";
import { Hint } from "@/components/shared/Hint";

function EstadoBadge({ estado, atenuado = false }: { estado: string; atenuado?: boolean }) {
  const visual = getEstadoVisual(estado);
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-2xs font-medium ${visual.badge} ${atenuado ? "opacity-60" : ""}`}
    >
      {/* FIX 6 (P3): si la bitácora guardó el estado como slug, se muestra en es-MX. */}
      {humanizarEnum(estado)}
    </span>
  );
}

export function FilaEntrada({
  entrada,
  mostrarUsuario,
}: {
  entrada: EntradaBitacora;
  mostrarUsuario: boolean;
}) {
  const Icono = ICONOS_ACCION[entrada.accion] ?? Activity;
  const colorClase = COLORES_ACCION[entrada.accion] ?? "bg-muted text-muted-foreground";
  const rutaModulo = RUTAS_MODULO[entrada.modulo];
  const linkEntidad =
    rutaModulo && entrada.entidad_id ? `${rutaModulo}/${entrada.entidad_id}` : undefined;
  const descripcion = describirEntrada(entrada);
  const esCambioEstado = !!(descripcion.estadoAnterior && descripcion.estadoNuevo);

  return (
    <div className="relative">
      <div
        className={`absolute -left-[calc(1.5rem+5px)] top-1 flex h-5 w-5 items-center justify-center rounded-full ${colorClase}`}
      >
        <Icono className="h-3 w-3" />
      </div>

      <div className="space-y-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          {mostrarUsuario && (
            <Hint label={entrada.usuario_email}>
              <span className="text-body-sm font-medium text-foreground">
                {nombreDesdeEmail(entrada.usuario_email)}
              </span>
            </Hint>
          )}
          <Hint label={formatDate(entrada.created_at, "dd/MM/yyyy HH:mm")}>
            <span className="text-body-sm text-muted-foreground">
              {formatRelativo(entrada.created_at)}
            </span>
          </Hint>
        </div>

        {esCambioEstado ? (
          <div className="flex items-center gap-1.5 flex-wrap text-body text-foreground">
            <span>Cambió estado de</span>
            <EstadoBadge estado={descripcion.estadoAnterior!} atenuado />
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <EstadoBadge estado={descripcion.estadoNuevo!} />
          </div>
        ) : (
          <p className="text-body text-foreground">{descripcion.titulo}</p>
        )}

        {descripcion.contexto && (
          <p className="text-body-sm text-muted-foreground">{descripcion.contexto}</p>
        )}

        <div className="flex items-baseline gap-1.5 flex-wrap text-body-sm text-muted-foreground">
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
}
