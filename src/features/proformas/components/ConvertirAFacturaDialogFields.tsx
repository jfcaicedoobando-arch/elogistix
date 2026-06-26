/** Sub-secciones del modal Convertir Proforma → Factura, extraídas para
 *  cumplir el límite de 200 líneas por archivo. */
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import {
  USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT,
} from "@/constants/catalogosSAT";

interface SerieRow {
  id: string;
  prefijo: string;
  folio_actual: number;
  activa: boolean;
}

interface Props {
  series: SerieRow[] | undefined;
  serieId: string;
  setSerieId: (v: string) => void;
  metodoPago: "PUE" | "PPD";
  setMetodoPago: (v: "PUE" | "PPD") => void;
  formaPago: string;
  setFormaPago: (v: string) => void;
  usoCfdi: string;
  setUsoCfdi: (v: string) => void;
  diasCredito: number;
  setDiasCredito: (v: number) => void;
  notas: string;
  setNotas: (v: string) => void;
}

export function DatosFiscalesFactura(props: Props) {
  return (
    <>
      <FormDialogSection title="Datos fiscales" cols={2}>
        <div className="space-y-1">
          <Label>Serie</Label>
          <Select value={props.serieId} onValueChange={props.setSerieId}>
            <SelectTrigger><SelectValue placeholder="Selecciona una serie" /></SelectTrigger>
            <SelectContent>
              {(props.series ?? []).map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.prefijo} (último folio: {s.folio_actual})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Método de pago</Label>
          <Select value={props.metodoPago} onValueChange={(v) => props.setMetodoPago(v as "PUE" | "PPD")}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {METODOS_PAGO_SAT.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Forma de pago</Label>
          <Select value={props.formaPago} onValueChange={props.setFormaPago}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGO_SAT.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Uso CFDI</Label>
          <Select value={props.usoCfdi} onValueChange={props.setUsoCfdi}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {USOS_CFDI_SAT.map((u) => (
                <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Días de crédito</Label>
          <Input
            type="number"
            min={0}
            value={props.diasCredito}
            onChange={(e) => props.setDiasCredito(Number(e.target.value) || 0)}
          />
        </div>
      </FormDialogSection>

      <FormDialogSection title="Notas internas (opcional)" cols={1}>
        <Textarea
          rows={3}
          value={props.notas}
          onChange={(e) => props.setNotas(e.target.value)}
          placeholder="Notas que se guardan en la factura (no llegan al SAT)."
        />
      </FormDialogSection>
    </>
  );
}

export type { SerieRow };
