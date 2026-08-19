/**
 * Bloque R — Campos adicionales del formulario de póliza: montos (suma
 * asegurada, deducible), cobertura, certificado, contacto y notas.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SeguroEmbarqueInput } from "@/features/embarques/services/seguros";

type FormState = Omit<SeguroEmbarqueInput, "embarque_id">;

interface Props {
  form: FormState;
  setField: <K extends keyof FormState>(k: K, v: FormState[K]) => void;
}

export function SeguroFormCamposAdicionales({ form, setField }: Props) {
  return (
    <>
      <div>
        <Label htmlFor="seguro-suma">Suma asegurada</Label>
        <Input id="seguro-suma" type="number" min={0} step={0.01} value={form.suma_asegurada}
          onChange={(e) => setField("suma_asegurada", Number(e.target.value))} />
        {form.suma_asegurada < 0 && (
          <p className="text-body-sm text-destructive mt-1">La suma asegurada no puede ser negativa.</p>
        )}
      </div>
      <div>
        <Label htmlFor="seguro-deducible">Deducible</Label>
        <Input id="seguro-deducible" type="number" min={0} step={0.01} value={form.deducible}
          onChange={(e) => setField("deducible", Number(e.target.value))} />
        {form.deducible < 0 && (
          <p className="text-body-sm text-destructive mt-1">El deducible no puede ser negativo.</p>
        )}
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="seguro-cobertura">Cobertura</Label>
        <Textarea id="seguro-cobertura" rows={2} value={form.cobertura_descripcion ?? ""}
          onChange={(e) => setField("cobertura_descripcion", e.target.value || null)} />
      </div>

      <div>
        <Label htmlFor="seguro-certificado">Certificado (URL)</Label>
        <Input id="seguro-certificado" value={form.certificado_url ?? ""}
          onChange={(e) => setField("certificado_url", e.target.value || null)} />
      </div>
      <div>
        <Label htmlFor="seguro-contacto">Contacto</Label>
        <Input id="seguro-contacto" value={form.contacto ?? ""} onChange={(e) => setField("contacto", e.target.value || null)} />
      </div>

      <div className="sm:col-span-2">
        <Label htmlFor="seguro-notas">Notas</Label>
        <Textarea id="seguro-notas" rows={2} value={form.notas ?? ""}
          onChange={(e) => setField("notas", e.target.value || null)} />
      </div>
    </>
  );
}
