/**
 * DiagnosticoFilters — Controles de filtrado para `/admin/diagnostico`.
 * Sin lógica de datos: sólo recibe valores y callbacks.
 */
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import type { AppLogLevel } from "@/features/admin/hooks";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL } from "@/lib/ui/rangoFechasCopy";

interface Props {
  level: AppLogLevel | "todos";
  onLevelChange: (v: AppLogLevel | "todos") => void;
  fn: string | "todos";
  onFnChange: (v: string) => void;
  fnOptions: string[];
  search: string;
  onSearchChange: (v: string) => void;
  from: string | null;
  to: string | null;
  onFromChange: (v: string | null) => void;
  onToChange: (v: string | null) => void;
  onReset: () => void;
}

export function DiagnosticoFilters({
  level,
  onLevelChange,
  fn,
  onFnChange,
  fnOptions,
  search,
  onSearchChange,
  from,
  to,
  onFromChange,
  onToChange,
  onReset,
}: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 rounded-md border bg-card p-4 md:grid-cols-6">
      <div className="md:col-span-2">
        <Label htmlFor="diag-search" className="text-xs">Buscar en mensaje</Label>
        <Input
          id="diag-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="texto contenido en msg…"
        />
      </div>
      <div>
        <Label className="text-xs">Nivel</Label>
        <Select value={level} onValueChange={(v) => onLevelChange(v as AppLogLevel | "todos")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="info">Info</SelectItem>
            <SelectItem value="warn">Warning</SelectItem>
            <SelectItem value="error">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs">Función</Label>
        <Select value={fn} onValueChange={onFnChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas</SelectItem>
            {fnOptions.map((f) => (
              <SelectItem key={f} value={f}>{f}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="diag-from" className="text-xs">{RANGO_DESDE_LABEL}</Label>
        <DatePickerMx
          value={from ?? ""}
          onChange={(v) => onFromChange(v || null)}
          className="w-full"
        />
      </div>
      <div>
        <Label htmlFor="diag-to" className="text-xs">{RANGO_HASTA_LABEL}</Label>
        <DatePickerMx
          value={to ?? ""}
          onChange={(v) => onToChange(v || null)}
          className="w-full"
        />
      </div>
      <div className="md:col-span-6 flex justify-end">
        <Button variant="ghost" size="sm" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpiar filtros
        </Button>
      </div>
    </div>
  );
}
