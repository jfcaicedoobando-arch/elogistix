/**
 * Editor de filas dinámicas para recargos de una tarifa marítima.
 * Conceptos sugeridos: BAF, LSS, ISPS, THC Origen, Cargos en Origen/Destino, Otro.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { TarifaRecargoInput } from "@/features/costeo/services/tarifas";

const CONCEPTOS = ["BAF", "LSS", "ISPS", "THC Origen", "Cargos en Origen", "Cargos en Destino", "Otro"];

interface Props {
  value: TarifaRecargoInput[];
  onChange: (next: TarifaRecargoInput[]) => void;
}

export function TarifaRecargosEditor({ value, onChange }: Props) {
  const update = (i: number, patch: Partial<TarifaRecargoInput>) => {
    onChange(value.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  };
  const add = () =>
    onChange([
      ...value,
      { concepto: "BAF", monto: 0, lado: "origen", incluido_en_total: true },
    ]);
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>Recargos (USD)</Label>
        <Button type="button" size="sm" variant="outline" onClick={add}>
          <Plus className="size-3.5 mr-1" /> Agregar recargo
        </Button>
      </div>

      {value.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Sin recargos. Sólo se cobrará el flete base.
        </p>
      )}

      {value.map((r, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-end">
          <div className="col-span-4">
            <Label htmlFor={`recargo-concepto-${i}`} className="sr-only">{`Concepto del recargo ${i + 1}`}</Label>
            <Select value={r.concepto} onValueChange={(v) => update(i, { concepto: v })}>
              <SelectTrigger
                id={`recargo-concepto-${i}`}
                aria-label={`Concepto del recargo ${i + 1}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONCEPTOS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3">
            <Label htmlFor={`recargo-monto-${i}`} className="sr-only">{`Monto del recargo ${i + 1}`}</Label>
            <Input
              id={`recargo-monto-${i}`}
              type="number"
              min={0}
              step="0.01"
              value={r.monto}
              onChange={(e) => update(i, { monto: Number(e.target.value) || 0 })}
              placeholder="Monto USD"
              aria-label={`Monto del recargo ${i + 1} en USD`}
            />
          </div>
          <div className="col-span-3">
            <Label htmlFor={`recargo-lado-${i}`} className="sr-only">{`Lado del recargo ${i + 1}`}</Label>
            <Select value={r.lado ?? "origen"} onValueChange={(v) => update(i, { lado: v as "origen" | "destino" })}>
              <SelectTrigger
                id={`recargo-lado-${i}`}
                aria-label={`Lado del recargo ${i + 1}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="origen">Origen</SelectItem>
                <SelectItem value="destino">Destino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex justify-end">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => remove(i)}
              aria-label={`Quitar recargo ${i + 1}`}
            >
              <Trash2 className="size-4 text-destructive" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
