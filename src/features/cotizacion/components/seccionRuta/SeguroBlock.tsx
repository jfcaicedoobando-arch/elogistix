import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormField } from "@/components/shared/FormField";
import type { Ctx } from "./overrideHelpers";

export default function SeguroBlock({ ctx, seguro }: { ctx: Ctx; seguro: boolean }) {
  const { watch, setValue } = ctx;
  return (
    <>
      <div className="flex items-center gap-3 pt-6">
        <Label htmlFor="cot-seguro-switch" className="text-sm font-medium">Seguro</Label>
        <Switch id="cot-seguro-switch" checked={seguro} onCheckedChange={v => setValue("seguro", v)} />
        <span className="text-sm text-muted-foreground">{seguro ? 'Sí' : 'No'}</span>
      </div>
      {seguro && (
        <FormField label="Valor de mercancía (USD)">
          <Input
            type="text" inputMode="decimal" pattern="[0-9]*\.?[0-9]*"
            value={watch("valorSeguroUsd") || ''}
            onChange={e => { const v = e.target.value; if (/^\d*\.?\d*$/.test(v)) setValue("valorSeguroUsd", Number(v) || 0); }}
            placeholder="0.00"
          />
        </FormField>
      )}
    </>
  );
}
