/**
 * DatosFiscalesForm — inputs y selects del formulario de datos fiscales.
 * v13.164.3 — se removió el input Serie: FacturAPI es la fuente de verdad
 * para serie y folio (ver `supabase/functions/facturapi-emitir/index.ts`).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";
import { addDaysIso } from "@/lib/date/dateOnly";
import { formatDate } from "@/lib/formatters/dates";

interface Option { value: string; label: string }

function SelectSAT({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: readonly Option[] }) {
  return (
    <div>
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export interface DatosFiscalesFormProps {
  usoCfdi: string; setUsoCfdi: (v: string) => void;
  formaPago: string; setFormaPago: (v: string) => void;
  metodoPago: string; setMetodoPago: (v: string) => void;
  diasCredito: number; setDiasCredito: (v: number) => void;
  tipoCambio: number | null; setTipoCambio: (v: number | null) => void;
  notas: string; setNotas: (v: string) => void;
  mostrarTipoCambio: boolean;
  /** Fecha de emisión del borrador; se usa para previsualizar el vencimiento. */
  fechaEmision?: string | null;
}

export function DatosFiscalesForm(p: DatosFiscalesFormProps) {
  // v13.331.9 — espejo de `fecha_emision + dias_credito` (trigger en BD), para
  // que el usuario vea de inmediato cuándo vencerá la factura.
  const vencimiento = addDaysIso(p.fechaEmision, p.diasCredito);
  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <SelectSAT label="Uso CFDI" value={p.usoCfdi} onChange={p.setUsoCfdi} options={USOS_CFDI_SAT} />
        <SelectSAT label="Método de pago" value={p.metodoPago} onChange={p.setMetodoPago} options={METODOS_PAGO_SAT} />
        <SelectSAT label="Forma de pago" value={p.formaPago} onChange={p.setFormaPago} options={FORMAS_PAGO_SAT} />
        <div>
          <Label>Días de crédito</Label>
          <Input
            type="number" min={0} value={p.diasCredito}
            onChange={(e) => p.setDiasCredito(Number(e.target.value) || 0)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {vencimiento
              ? `Vence el ${formatDate(vencimiento)}`
              : "Vencimiento: se calcula al guardar la fecha de emisión"}
          </p>
        </div>
        {p.mostrarTipoCambio && (
          <div>
            <Label>Tipo de cambio</Label>
            <Input
              type="number" step="0.0001" min={0}
              value={p.tipoCambio ?? ""}
              placeholder="Capturar TC del día"
              onChange={(e) => {
                const raw = e.target.value.trim();
                if (raw === "") return p.setTipoCambio(null);
                const n = Number(raw);
                p.setTipoCambio(Number.isFinite(n) && n > 0 ? n : null);
              }}
            />
          </div>
        )}
      </div>

      <div>
        <Label>Notas</Label>
        <Textarea
          value={p.notas} onChange={(e) => p.setNotas(e.target.value)} rows={2}
          placeholder="Notas internas para el CFDI (opcional)"
        />
      </div>
    </>
  );
}
