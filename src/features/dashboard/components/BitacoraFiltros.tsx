import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GRUPOS_ACCION } from "@/lib/domain/bitacoraDescripcion";
import { MODULOS_BITACORA } from "@/services/bitacora/registrar";
import { FILTRO_ANCHO } from "@/lib/ui/filterWidths";

export interface RangoBitacora {
  valor: string;
  etiqueta: string;
  dias: number | null;
}

interface BitacoraFiltrosProps {
  rangos: readonly RangoBitacora[];
  moduloFiltro: string;
  accionFiltro: string;
  rangoFiltro: string;
  mostrarLogins: boolean;
  mostrarSwitchLogins: boolean;
  total: number;
  onModuloChange: (v: string) => void;
  onAccionChange: (v: string) => void;
  onRangoChange: (v: string) => void;
  onMostrarLoginsChange: (v: boolean) => void;
}

/**
 * Barra de filtros de la bitácora. Extraída de `Bitacora.tsx` para respetar el
 * límite de 200 líneas (Power of 10) sin cambiar el comportamiento.
 */
export function BitacoraFiltros({
  rangos,
  moduloFiltro,
  accionFiltro,
  rangoFiltro,
  mostrarLogins,
  mostrarSwitchLogins,
  total,
  onModuloChange,
  onAccionChange,
  onRangoChange,
  onMostrarLoginsChange,
}: BitacoraFiltrosProps) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select value={moduloFiltro} onValueChange={onModuloChange}>
        <SelectTrigger className={FILTRO_ANCHO.md}>
          <SelectValue placeholder="Módulo" />
        </SelectTrigger>
        <SelectContent>
          {MODULOS_BITACORA.map((modulo) => (
            <SelectItem key={modulo.valor} value={modulo.valor}>
              {modulo.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={accionFiltro} onValueChange={onAccionChange}>
        <SelectTrigger className={FILTRO_ANCHO.md}>
          <SelectValue placeholder="Acción" />
        </SelectTrigger>
        <SelectContent>
          {GRUPOS_ACCION.map((grupo) => (
            <SelectItem key={grupo.valor} value={grupo.valor}>
              {grupo.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={rangoFiltro} onValueChange={onRangoChange}>
        <SelectTrigger className={FILTRO_ANCHO.md}>
          <SelectValue placeholder="Rango" />
        </SelectTrigger>
        <SelectContent>
          {rangos.map((rango) => (
            <SelectItem key={rango.valor} value={rango.valor}>
              {rango.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {mostrarSwitchLogins && (
        <div className="flex items-center gap-2">
          <Switch id="mostrar-logins" checked={mostrarLogins} onCheckedChange={onMostrarLoginsChange} />
          <Label size="sm" htmlFor="mostrar-logins" className="text-muted-foreground cursor-pointer">
            Incluir logins
          </Label>
        </div>
      )}

      <span className="text-body-sm text-muted-foreground ml-auto">
        {total} {total === 1 ? "registro" : "registros"}
      </span>
    </div>
  );
}
