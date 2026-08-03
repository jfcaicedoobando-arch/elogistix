/**
 * Barra de filtros y ordenamiento de la bitácora de tesorería.
 */
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { rangoLabel } from "@/lib/ui/rangoFechasCopy";
import {
  FILTROS_BITACORA_TESORERIA_INICIALES,
  ORDEN_BITACORA_LABELS,
  TIPO_MOVIMIENTO_LABELS,
  hayFiltrosBitacoraActivos,
  type FiltrosBitacoraTesoreria,
  type OrdenBitacora,
  type TipoMovimientoBitacora,
} from "@/features/cxp/services/bitacoraTesoreriaFiltros";

interface Props {
  filtros: FiltrosBitacoraTesoreria;
  onChange: (filtros: FiltrosBitacoraTesoreria) => void;
  usuarios: string[];
}

export function BitacoraTesoreriaToolbar({ filtros, onChange, usuarios }: Props) {
  const set = <K extends keyof FiltrosBitacoraTesoreria>(
    key: K,
    valor: FiltrosBitacoraTesoreria[K],
  ) => onChange({ ...filtros, [key]: valor });

  return (
    <div className="grid gap-3 rounded-md border bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1">
        <Label className="text-xs" htmlFor="bitacora-tes-desde">{rangoLabel("Pago", "desde")}</Label>
        <DatePickerMx
          id="bitacora-tes-desde"
          value={filtros.desde}
          onChange={(iso) => set("desde", iso)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs" htmlFor="bitacora-tes-hasta">{rangoLabel("Pago", "hasta")}</Label>
        <DatePickerMx
          id="bitacora-tes-hasta"
          value={filtros.hasta}
          onChange={(iso) => set("hasta", iso)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs" htmlFor="bitacora-tes-tipo">Tipo de movimiento</Label>
        <Select
          value={filtros.tipo}
          onValueChange={(v) => set("tipo", v as TipoMovimientoBitacora)}
        >
          <SelectTrigger id="bitacora-tes-tipo" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(TIPO_MOVIMIENTO_LABELS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs" htmlFor="bitacora-tes-usuario">Usuario / operador</Label>
        <Select value={filtros.usuario} onValueChange={(v) => set("usuario", v)}>
          <SelectTrigger id="bitacora-tes-usuario" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos los usuarios</SelectItem>
            {usuarios.map((u) => (
              <SelectItem key={u} value={u}>{u}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <Label className="text-xs" htmlFor="bitacora-tes-orden">Ordenar por fecha</Label>
        <Select
          value={filtros.orden}
          onValueChange={(v) => set("orden", v as OrdenBitacora)}
        >
          <SelectTrigger id="bitacora-tes-orden" className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ORDEN_BITACORA_LABELS).map(([valor, label]) => (
              <SelectItem key={valor} value={valor}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hayFiltrosBitacoraActivos(filtros) && (
        <div className="sm:col-span-2 lg:col-span-5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ ...FILTROS_BITACORA_TESORERIA_INICIALES, orden: filtros.orden })}
          >
            Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
