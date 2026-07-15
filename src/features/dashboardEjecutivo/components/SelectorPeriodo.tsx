import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// NOTA: "ytd" se mantiene en el tipo por compatibilidad con estado persistido,
// pero se oculta del selector hasta que el backend soporte rangos acumulados.
export type PresetPeriodo = "actual" | "anterior" | "ytd";

interface Props {
  value: string; // YYYY-MM
  preset: PresetPeriodo;
  onChange: (periodo: string, preset: PresetPeriodo) => void;
}

function periodoActual(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodoAnterior(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function SelectorPeriodo({ value, preset, onChange }: Props) {
  const handle = (p: PresetPeriodo) => {
    if (p === "anterior") onChange(periodoAnterior(), p);
    else onChange(periodoActual(), "actual");
  };
  // Si viniera un preset "ytd" persistido, degradamos a "actual" en el trigger
  // sin romper la persistencia del padre.
  const presetVisible: "actual" | "anterior" = preset === "anterior" ? "anterior" : "actual";

  return (
    <div className="flex items-center gap-2">
      <Select value={presetVisible} onValueChange={(v) => handle(v as PresetPeriodo)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="actual">Mes actual</SelectItem>
          <SelectItem value="anterior">Mes anterior</SelectItem>
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">Periodo: {value}</span>
    </div>
  );
}
