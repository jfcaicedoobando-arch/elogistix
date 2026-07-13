import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PresetRango } from "../hooks/useEstadoCuentaDateRange";

interface Props {
  presetActivo: PresetRango | null;
  onPreset: (p: PresetRango) => void;
  soloConSaldo: boolean;
  onSoloConSaldoChange: (v: boolean) => void;
  moneda: "MXN" | "USD" | "todas";
  onMonedaChange: (v: "MXN" | "USD" | "todas") => void;
}

const PRESETS: Array<{ id: PresetRango; label: string }> = [
  { id: "30d", label: "Últimos 30 días" },
  { id: "mes", label: "Este mes" },
  { id: "trimestre", label: "Trimestre" },
  { id: "anio", label: "Este año" },
  { id: "historico", label: "Histórico" },
];

export function EstadoCuentaFilters({
  presetActivo,
  onPreset,
  soloConSaldo,
  onSoloConSaldoChange,
  moneda,
  onMonedaChange,
}: Props) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border rounded-lg p-3 bg-card">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={presetActivo === p.id ? "default" : "outline"}
            onClick={() => onPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label htmlFor="ec-moneda" className="text-xs text-muted-foreground">
            Moneda
          </Label>
          <Select value={moneda} onValueChange={(v) => onMonedaChange(v as "MXN" | "USD" | "todas")}>
            <SelectTrigger id="ec-moneda" className="h-8 w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="MXN">MXN</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="ec-solo-saldo"
            checked={soloConSaldo}
            onCheckedChange={onSoloConSaldoChange}
          />
          <Label htmlFor="ec-solo-saldo" className="text-xs cursor-pointer">
            Sólo con saldo pendiente
          </Label>
        </div>
      </div>
    </div>
  );
}
