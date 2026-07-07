/**
 * Selector de periodo fiscal para el cockpit de Facturación (Fase 1).
 *
 * Presenta presets alineados con el uso contable diario (Este mes,
 * Mes pasado, Este trimestre, Ejercicio, Todo) y aplica el rango sobre
 * `useFacturacionDateRange` (que ya sincroniza con la URL).
 *
 * NO bloquea captura ni valida cierre contable — es sólo filtro visual.
 * El cierre "duro" de período fiscal quedó fuera de alcance por
 * decisión de producto.
 */
import { useMemo } from "react";
import { Calendar } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type Preset = "mes" | "mes_pasado" | "trimestre" | "ejercicio" | "todo" | "personalizado";

interface Props {
  desdeIso: string | null;
  hastaIso: string | null;
  onChange: (rango: { desde: Date | null; hasta: Date | null }) => void;
}

function firstOfMonth(y: number, m: number): Date {
  return new Date(y, m, 1);
}
function lastOfMonth(y: number, m: number): Date {
  return new Date(y, m + 1, 0);
}
function isoOf(d: Date): string {
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function calcRango(preset: Preset): { desde: Date | null; hasta: Date | null } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (preset) {
    case "mes":
      return { desde: firstOfMonth(y, m), hasta: lastOfMonth(y, m) };
    case "mes_pasado":
      return { desde: firstOfMonth(y, m - 1), hasta: lastOfMonth(y, m - 1) };
    case "trimestre": {
      const qStart = Math.floor(m / 3) * 3;
      return { desde: firstOfMonth(y, qStart), hasta: lastOfMonth(y, qStart + 2) };
    }
    case "ejercicio":
      return { desde: new Date(y, 0, 1), hasta: new Date(y, 11, 31) };
    case "todo":
    case "personalizado":
    default:
      return { desde: null, hasta: null };
  }
}

function detectarPreset(desdeIso: string | null, hastaIso: string | null): Preset {
  if (!desdeIso && !hastaIso) return "todo";
  for (const p of ["mes", "mes_pasado", "trimestre", "ejercicio"] as Preset[]) {
    const r = calcRango(p);
    if (r.desde && r.hasta && isoOf(r.desde) === desdeIso && isoOf(r.hasta) === hastaIso) {
      return p;
    }
  }
  return "personalizado";
}

const NOMBRES_MES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function etiquetaMesActual(): string {
  const now = new Date();
  return `${NOMBRES_MES_LARGO[now.getMonth()]} ${now.getFullYear()}`;
}

export function PeriodoFiscalSelector({ desdeIso, hastaIso, onChange }: Props) {
  const preset = useMemo(() => detectarPreset(desdeIso, hastaIso), [desdeIso, hastaIso]);

  const handleChange = (next: string) => {
    onChange(calcRango(next as Preset));
  };

  return (
    <div className="flex items-center gap-2">
      <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden />
      <Select value={preset} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-[190px] text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="mes">Este mes · {etiquetaMesActual()}</SelectItem>
          <SelectItem value="mes_pasado">Mes pasado</SelectItem>
          <SelectItem value="trimestre">Este trimestre</SelectItem>
          <SelectItem value="ejercicio">Ejercicio en curso</SelectItem>
          <SelectItem value="todo">Todo</SelectItem>
          {preset === "personalizado" && (
            <SelectItem value="personalizado">Personalizado</SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
