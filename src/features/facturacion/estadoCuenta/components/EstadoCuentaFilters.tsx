import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PresetRango } from "../hooks/useEstadoCuentaDateRange";

interface Props {
  presetActivo: PresetRango | null;
  onPreset: (p: PresetRango) => void;
  soloConSaldo: boolean;
  onSoloConSaldoChange: (v: boolean) => void;
  moneda: "MXN" | "USD" | "todas";
  onMonedaChange: (v: "MXN" | "USD" | "todas") => void;
  busqueda: string;
  onBusquedaChange: (v: string) => void;
}

const PRESETS: Array<{ id: PresetRango; label: string }> = [
  { id: "30d", label: "30 días" },
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
  busqueda,
  onBusquedaChange,
}: Props) {
  return (
    <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            className="h-8"
            variant={presetActivo === p.id ? "default" : "outline"}
            onClick={() => onPreset(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => onBusquedaChange(e.target.value)}
            placeholder="Folio o expediente"
            aria-label="Buscar por folio o expediente"
            className="h-8 w-48 pl-7 text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="ec-moneda" className="text-xs text-muted-foreground">
            Moneda
          </Label>
          <Select value={moneda} onValueChange={(v) => onMonedaChange(v as "MXN" | "USD" | "todas")}>
            <SelectTrigger id="ec-moneda" className="h-8 w-24">
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
          <Label htmlFor="ec-solo-saldo" className="cursor-pointer text-xs">
            Sólo con saldo
          </Label>
        </div>
      </div>
    </div>
  );
}
