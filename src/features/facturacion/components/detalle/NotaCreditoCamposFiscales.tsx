/**
 * Bloque de campos fiscales (fecha, motivo, uso CFDI, forma de pago,
 * descripción) para DialogCrearNotaCredito.
 *
 * v13.213.20 — se quitó el campo "Folio interno": el borrador arranca con
 * `BORRADOR-<ts>` y al timbrar FacturAPI es la fuente de verdad
 * (`<serie><folio>`), igual que en facturas.
 */
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { todayLocalISO } from "@/lib/date/today";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT } from "@/constants/catalogosSAT";
import type { MotivoNotaCredito as Motivo } from "@/features/facturacion/types";

const MOTIVOS: { value: Motivo; label: string }[] = [
  { value: "Devolucion", label: "Devolución" },
  { value: "Descuento", label: "Descuento" },
  { value: "Bonificacion", label: "Bonificación" },
  { value: "Error", label: "Error de facturación" },
  { value: "Otro", label: "Otro" },
];

interface Props {
  /** B-24: fecha de emisión de la factura original — cota inferior de la NC. */
  fechaMinima?: string | null;
  fecha: string;
  setFecha: (v: string) => void;
  motivo: Motivo;
  setMotivo: (m: Motivo) => void;
  usoCfdi: string;
  setUsoCfdi: (v: string) => void;
  formaPago: string;
  setFormaPago: (v: string) => void;
  descripcion: string;
  setDescripcion: (v: string) => void;
}

export function NotaCreditoCamposFiscales(props: Props) {
  const { fechaMinima, fecha, setFecha, motivo, setMotivo, usoCfdi, setUsoCfdi, formaPago, setFormaPago, descripcion, setDescripcion } = props;
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="nc-fecha">Fecha *</Label>
          <DatePickerMx
            value={fecha}
            onChange={setFecha}
            className="w-full"
            min={fechaMinima ? fechaMinima.slice(0, 10) : undefined}
            max={todayLocalISO()}
          />
          <p className="text-label text-muted-foreground">
            No puede ser anterior a la emisión de la factura ni futura.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Motivo SAT *</Label>
          <Select value={motivo} onValueChange={(v) => setMotivo(v as Motivo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Uso CFDI *</Label>
          <Select value={usoCfdi} onValueChange={setUsoCfdi}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {USOS_CFDI_SAT.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Forma de pago *</Label>
          <Select value={formaPago} onValueChange={setFormaPago}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="nc-desc">Descripción / Justificación *</Label>
        <Textarea
          id="nc-desc" value={descripcion} onChange={(e) => setDescripcion(e.target.value)}
          rows={2} placeholder="Motivo del crédito al cliente"
        />
      </div>
    </>
  );
}
