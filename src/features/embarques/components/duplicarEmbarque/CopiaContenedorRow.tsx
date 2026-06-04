/**
 * Fila editable de una copia de embarque (contenedor + dimensiones).
 */
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { NumericInput } from "@/components/shared/NumericInput";
import type { CopiaContenedor } from "./types";

interface TipoOption {
  id: string;
  code: string;
  name: string;
}

interface Props {
  idx: number;
  copia: CopiaContenedor;
  tiposContenedor: TipoOption[];
  canRemove: boolean;
  onChange: <K extends keyof CopiaContenedor>(campo: K, value: CopiaContenedor[K]) => void;
  onRemove: () => void;
}

export function CopiaContenedorRow({
  idx, copia, tiposContenedor, canRemove, onChange, onRemove,
}: Props) {
  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">Copia {idx + 1}</Label>
        {canRemove && (
          <Button
            type="button" variant="ghost" size="icon"
            onClick={onRemove} aria-label={`Quitar copia ${idx + 1}`}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_100px_100px_80px] gap-2">
        <div className="space-y-1">
          <Label htmlFor={`num-${idx}`} className="text-xs">Número de contenedor</Label>
          <Input
            id={`num-${idx}`} value={copia.num_contenedor}
            onChange={(e) => onChange("num_contenedor", e.target.value)}
            placeholder="Número de contenedor" autoComplete="off" className="h-8"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={copia.tipo_contenedor || undefined}
            onValueChange={(v) => onChange("tipo_contenedor", v)}
          >
            <SelectTrigger className="h-8">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              {tiposContenedor.map((t) => (
                <SelectItem key={t.id} value={t.code}>
                  {t.code} — {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Peso (kg)</Label>
          <NumericInput
            value={copia.peso_kg} onChange={(n) => onChange("peso_kg", n)}
            decimals aria-label="Peso en kilogramos"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Volumen (m³)</Label>
          <NumericInput
            value={copia.volumen_m3} onChange={(n) => onChange("volumen_m3", n)}
            decimals aria-label="Volumen en metros cúbicos"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Piezas</Label>
          <NumericInput
            value={copia.piezas} onChange={(n) => onChange("piezas", n)}
            aria-label="Piezas"
          />
        </div>
      </div>
    </div>
  );
}
