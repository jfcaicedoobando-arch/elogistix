/**
 * Selectores compactos de retención ISR / IVA para un renglón de factura.
 * Se combinan libremente: p.ej. autotransporte suele ir ISR 10% + IVA 4%.
 */
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  RET_ISR_OPTIONS, RET_IVA_OPTIONS,
  isrKeyFromTasa, ivaKeyFromTasa,
  tasaFromIsrKey, tasaFromIvaKey,
  type RetencionIsrKey, type RetencionIvaKey,
} from "@/features/facturacion/constants/retenciones";

interface Props {
  tasaIsr: number;
  tasaIva: number;
  onChange: (patch: { tasa_ret_isr?: number; tasa_ret_iva?: number }) => void;
}

export function RetencionSelects({ tasaIsr, tasaIva, onChange }: Props) {
  const isrKey = isrKeyFromTasa(tasaIsr);
  const ivaKey = ivaKeyFromTasa(tasaIva);
  return (
    <>
      <div className="col-span-2">
        <Label className="text-xs">Ret. ISR</Label>
        <Select
          value={isrKey}
          onValueChange={(v) => onChange({ tasa_ret_isr: tasaFromIsrKey(v as RetencionIsrKey) })}
        >
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RET_ISR_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="col-span-2">
        <Label className="text-xs">Ret. IVA</Label>
        <Select
          value={ivaKey}
          onValueChange={(v) => onChange({ tasa_ret_iva: tasaFromIvaKey(v as RetencionIvaKey) })}
        >
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RET_IVA_OPTIONS.map((o) => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
