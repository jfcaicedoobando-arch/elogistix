/**
 * Barra de filtros del libro maestro de pagos: periodo con atajos, cuenta,
 * moneda, método de pago, conciliación, complemento y búsqueda.
 */
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  type FiltroConciliacion, type FiltroRep, type FiltrosLibroPagos,
} from "@/features/tesoreria/domain/libroPagos";
import {
  rangoAnioPagos, rangoMesPagos, rangoTrimestrePagos, type RangoPagos,
} from "@/features/tesoreria/domain/libroPagosRangos";

interface CuentaOption {
  id: string;
  alias: string;
  moneda: string;
}

interface Props {
  cuentas: CuentaOption[];
  monedas: string[];
  metodos: string[];
  filtros: FiltrosLibroPagos;
  onFiltrosChange: (patch: Partial<FiltrosLibroPagos>) => void;
  rango: RangoPagos;
  onRangoChange: (rango: RangoPagos) => void;
}

export function LibroPagosToolbar({
  cuentas, monedas, metodos, filtros, onFiltrosChange, rango, onRangoChange,
}: Props) {
  return (
    <Card>
      <CardContent density="compact" className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Desde</p>
          <DatePickerMx
            value={rango.desde}
            onChange={(iso) => onRangoChange({ ...rango, desde: iso })}
            max={rango.hasta}
          />
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Hasta</p>
          <DatePickerMx
            value={rango.hasta}
            onChange={(iso) => onRangoChange({ ...rango, hasta: iso })}
            min={rango.desde}
          />
        </div>

        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="sm" onClick={() => onRangoChange(rangoMesPagos())}>
            Mes
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onRangoChange(rangoTrimestrePagos())}>
            Trimestre
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onRangoChange(rangoAnioPagos())}>
            Año
          </Button>
        </div>

        <div className="min-w-[170px]">
          <p className="text-xs text-muted-foreground mb-1">Cuenta bancaria</p>
          <Select
            value={filtros.cuentaId}
            onValueChange={(v) => onFiltrosChange({ cuentaId: v })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas las cuentas</SelectItem>
              {cuentas.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.alias} · {c.moneda}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[120px]">
          <p className="text-xs text-muted-foreground mb-1">Moneda</p>
          <Select value={filtros.moneda} onValueChange={(v) => onFiltrosChange({ moneda: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              {monedas.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[150px]">
          <p className="text-xs text-muted-foreground mb-1">Método de pago</p>
          <Select value={filtros.metodo} onValueChange={(v) => onFiltrosChange({ metodo: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {metodos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[150px]">
          <p className="text-xs text-muted-foreground mb-1">Conciliación</p>
          <Select
            value={filtros.conciliacion}
            onValueChange={(v) => onFiltrosChange({ conciliacion: v as FiltroConciliacion })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="conciliados">Conciliados</SelectItem>
              <SelectItem value="pendientes">Sin conciliar</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[170px]">
          <p className="text-xs text-muted-foreground mb-1">Complemento de pago</p>
          <Select
            value={filtros.rep}
            onValueChange={(v) => onFiltrosChange({ rep: v as FiltroRep })}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="timbrado">Timbrado</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="cancelado">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-[200px] flex-1">
          <p className="text-xs text-muted-foreground mb-1">Buscar</p>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              className="pl-8"
              value={filtros.texto}
              onChange={(e) => onFiltrosChange({ texto: e.target.value })}
              placeholder="Cliente, proveedor, folio o referencia"
              aria-label="Buscar pagos por contraparte, folio o referencia"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
