/**
 * Barra de filtros del libro maestro de pagos: periodo con atajos, cuenta,
 * moneda, método de pago, conciliación, complemento y búsqueda.
 */
import { Search, SlidersHorizontal } from "lucide-react";
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
  const filtrosSecundarios = (
    <>
      <FiltroCuenta cuentas={cuentas} value={filtros.cuentaId} onChange={(cuentaId) => onFiltrosChange({ cuentaId })} />
      <FiltroSelect label="Moneda" value={filtros.moneda} options={["todas", ...monedas]} onChange={(moneda) => onFiltrosChange({ moneda })} />
      <FiltroSelect label="Método de pago" value={filtros.metodo} options={["todos", ...metodos]} onChange={(metodo) => onFiltrosChange({ metodo })} />
      <FiltroSelect label="Conciliación" value={filtros.conciliacion} options={["todos", "conciliados", "pendientes"]} onChange={(conciliacion) => onFiltrosChange({ conciliacion: conciliacion as FiltroConciliacion })} />
      <FiltroSelect label="Complemento" value={filtros.rep} options={["todos", "timbrado", "pendiente", "cancelado"]} onChange={(rep) => onFiltrosChange({ rep: rep as FiltroRep })} />
    </>
  );
  return (
    <Card>
      <CardContent density="compact" className="grid grid-cols-2 items-end gap-3 short:gap-2 md:grid-cols-12">
        <div className="md:col-span-2">
          <p className="text-body-sm text-muted-foreground mb-1">Desde</p>
          <DatePickerMx
            value={rango.desde}
            onChange={(iso) => onRangoChange({ ...rango, desde: iso })}
            max={rango.hasta}
          />
        </div>
        <div className="md:col-span-2">
          <p className="text-body-sm text-muted-foreground mb-1">Hasta</p>
          <DatePickerMx
            value={rango.hasta}
            onChange={(iso) => onRangoChange({ ...rango, hasta: iso })}
            min={rango.desde}
          />
        </div>

        <div className="flex items-center gap-1 md:col-span-3">
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

        <details className="col-span-2 md:hidden">
          <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-2 rounded-md border px-3 text-body-sm font-medium"><SlidersHorizontal className="size-4" />Más filtros</summary>
          <div className="mt-3 grid grid-cols-2 gap-3">{filtrosSecundarios}</div>
        </details>
        <div className="hidden md:contents">{filtrosSecundarios}</div>

        <div className="col-span-2 md:col-span-5 md:row-start-1 md:col-start-8">
          <p className="text-body-sm text-muted-foreground mb-1">Buscar</p>
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

function FiltroSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <div><p className="mb-1 text-body-sm text-muted-foreground">{label}</p><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o} value={o}>{o === "todos" || o === "todas" ? "Todos" : o}</SelectItem>)}</SelectContent></Select></div>;
}

function FiltroCuenta({ cuentas, value, onChange }: { cuentas: CuentaOption[]; value: string; onChange: (value: string) => void }) {
  return <div className="col-span-2 md:col-span-3"><p className="mb-1 text-body-sm text-muted-foreground">Cuenta bancaria</p><Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="todas">Todas las cuentas</SelectItem>{cuentas.map((c) => <SelectItem key={c.id} value={c.id}>{c.alias} · {c.moneda}</SelectItem>)}</SelectContent></Select></div>;
}
