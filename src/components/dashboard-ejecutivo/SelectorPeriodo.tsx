import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    if (p === "actual") onChange(periodoActual(), p);
    else if (p === "anterior") onChange(periodoAnterior(), p);
    else onChange(periodoActual(), p); // YTD usa el mes actual como ancla
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={preset} onValueChange={(v) => handle(v as PresetPeriodo)}>
        <SelectTrigger className="w-44">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="actual">Mes actual</SelectItem>
          <SelectItem value="anterior">Mes anterior</SelectItem>
          <SelectItem value="ytd">YTD (año en curso)</SelectItem>
        </SelectContent>
      </Select>
      <span className="text-xs text-muted-foreground">Periodo: {value}</span>
    </div>
  );
}
