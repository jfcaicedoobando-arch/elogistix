import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Timer } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import type { DemoraVentaTarifaInput } from "@/features/costeo/services/demorasVenta";
import { RANGO_DESDE_LABEL, RANGO_HASTA_LABEL, rangoLabel } from "@/lib/ui/rangoFechasCopy";

type Tipo = { id: string; code?: string | null; name: string };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  form: DemoraVentaTarifaInput;
  setForm: (f: DemoraVentaTarifaInput) => void;
  tipos: Tipo[];
  isPending: boolean;
  tipoInvalido: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export function NuevaTarifaDemoraDialog({
  open, onOpenChange, form, setForm, tipos, isPending, tipoInvalido, onSubmit,
}: Props) {
  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      icon={Timer}
      title="Nueva tarifa de venta"
      description="Define una nueva tarifa de venta por demoras aplicable a los embarques."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="dem-venta-form" disabled={isPending}>
            Guardar
          </Button>
        </>
      }
    >
      <form id="dem-venta-form" onSubmit={onSubmit} className="space-y-3">
        <div>
          <Label htmlFor="dem-tipo">Tipo de contenedor *</Label>
          <Select
            value={form.tipo_contenedor_id}
            onValueChange={(v) => setForm({ ...form, tipo_contenedor_id: v })}
          >
            <SelectTrigger
              id="dem-tipo"
              aria-invalid={tipoInvalido || undefined}
              className={tipoInvalido ? "border-destructive" : undefined}
            >
              <SelectValue placeholder="Selecciona…" />
            </SelectTrigger>
            <SelectContent>
              {tipos.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.code || t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="dem-desde">Desde día</Label>
            <Input
              id="dem-desde"
              type="number"
              min={1}
              value={form.desde_dia}
              onChange={(e) => setForm({ ...form, desde_dia: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label htmlFor="dem-hasta">Hasta día (vacío = ∞)</Label>
            <Input
              id="dem-hasta"
              type="number"
              value={form.hasta_dia ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  hasta_dia: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
        </div>
        <div>
          <Label htmlFor="dem-monto">Monto por día (USD)</Label>
          <Input
            id="dem-monto"
            type="number"
            step="0.01"
            min={0}
            value={form.monto_por_dia_usd}
            onChange={(e) => setForm({ ...form, monto_por_dia_usd: Number(e.target.value) })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="dem-vig-desde">{rangoLabel("Vigencia", "desde")}</Label>
            <DatePickerMx
              value={form.vigente_desde}
              onChange={(v) => setForm({ ...form, vigente_desde: v })}
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="dem-vig-hasta">{rangoLabel("Vigencia", "hasta")}</Label>
            <DatePickerMx
              value={form.vigente_hasta ?? ""}
              onChange={(v) => setForm({ ...form, vigente_hasta: v || null })}
              className="w-full"
            />
          </div>
        </div>
      </form>
    </FormDialogShell>
  );
}
