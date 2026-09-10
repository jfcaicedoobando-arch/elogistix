/**
 * Bloque de campos fiscales (fecha, motivo, forma de pago, descripción) para
 * DialogCrearNotaCredito.
 *
 * v13.823.297 — el uso del CFDI dejó de ser un desplegable: el SAT sólo acepta
 * G02 en un egreso, así que se muestra como dato fijo. La forma de pago llega
 * sugerida según si la factura ya se cobró, con su explicación.
 */
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { todayLocalISO } from "@/lib/date/today";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FORMAS_PAGO_SAT } from "@/constants/catalogosSAT";
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
  formaPago: string;
  setFormaPago: (v: string) => void;
  explicacionFormaPago: string;
  descripcion: string;
  setDescripcion: (v: string) => void;
  /** Factura original relacionada (folio + UUID) para confirmar el vínculo. */
  facturaNumero: string;
  uuidFacturaOriginal: string | null;
}

export function NotaCreditoCamposFiscales(props: Props) {
  const {
    fechaMinima, fecha, setFecha, motivo, setMotivo, formaPago, setFormaPago,
    explicacionFormaPago, descripcion, setDescripcion, facturaNumero, uuidFacturaOriginal,
  } = props;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <Label>Motivo *</Label>
          <Select value={motivo} onValueChange={(v) => setMotivo(v as Motivo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-label text-muted-foreground">Uso interno; no viaja al CFDI.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nc-forma-pago">Forma de pago *</Label>
          <Select value={formaPago} onValueChange={setFormaPago}>
            <SelectTrigger id="nc-forma-pago"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-label text-muted-foreground">{explicacionFormaPago}</p>
        </div>
        <div className="space-y-1.5">
          <Label>Datos fiscales fijos</Label>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-label text-muted-foreground space-y-0.5">
            <p>Uso del CFDI: <strong className="text-foreground">G02</strong> · Devoluciones, descuentos o bonificaciones</p>
            <p>Método de pago: <strong className="text-foreground">PUE</strong> (los egresos no admiten parcialidades)</p>
            <p className="truncate">
              Relacionada con: <strong className="text-foreground">{facturaNumero}</strong>
              {uuidFacturaOriginal ? ` · ${uuidFacturaOriginal}` : " · sin folio fiscal aún"}
            </p>
          </div>
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
