import { Input } from "@/components/ui/input";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CargaXmlNcSection } from "./CargaXmlNcSection";
import type {
  MotivoNotaCreditoProveedor as MotivoNC,
  MonedaNotaCreditoProveedor as MonedaNC,
} from "@/features/cxp/types";
import type { CfdiParsedResponse } from "@/features/cxp/services";

const MOTIVOS: { value: MotivoNC; label: string }[] = [
  { value: "Devolucion", label: "Devolución" },
  { value: "Bonificacion", label: "Bonificación" },
  { value: "Descuento", label: "Descuento" },
  { value: "ErrorFacturacion", label: "Error de facturación" },
  { value: "Cancelacion", label: "Cancelación" },
  { value: "Otro", label: "Otro" },
];

export function TabButton({ active, onClick, children }: {
  active: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 text-body font-medium transition-colors ${
        active ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

/** Captura por XML vs manual. */
interface OrigenNc {
  mode: "manual" | "cfdi";
  onModeChange: (mode: "manual" | "cfdi") => void;
  parsedCfdi: CfdiParsedResponse | null;
  onCfdiParsed: (data: CfdiParsedResponse, files: { xml: File; pdf: File | null }) => void;
}

/** Datos base de la nota de crédito. */
interface DatosNc {
  folio: string;
  onFolioChange: (v: string) => void;
  fecha: string;
  onFechaChange: (v: string) => void;
  monto: string;
  onMontoChange: (v: string) => void;
  motivo: MotivoNC;
  onMotivoChange: (v: MotivoNC) => void;
  descripcion: string;
  onDescripcionChange: (v: string) => void;
}

/** Moneda de la NC y su tipo de cambio contra la factura. */
interface MonedaNcProps {
  monedaFactura: MonedaNC;
  saldoFactura: number;
  moneda: MonedaNC;
  onMonedaChange: (v: MonedaNC) => void;
  tipoCambio: string;
  onTipoCambioChange: (v: string) => void;
}

interface Props {
  origen: OrigenNc;
  datos: DatosNc;
  divisa: MonedaNcProps;
}

const MONEDAS: MonedaNC[] = ["MXN", "USD", "EUR"];

export function NuevaNotaCreditoFormFields({ origen, datos, divisa }: Props) {
  const { mode, onModeChange, parsedCfdi, onCfdiParsed } = origen;
  const {
    folio, onFolioChange, fecha, onFechaChange, monto, onMontoChange,
    motivo, onMotivoChange, descripcion, onDescripcionChange,
  } = datos;
  const {
    monedaFactura, saldoFactura, moneda, onMonedaChange, tipoCambio, onTipoCambioChange,
  } = divisa;
  const monedaExtranjera = moneda === "MXN" ? monedaFactura : moneda;
  return (
    <div className="rounded-lg border bg-muted/30">
      <div className="flex border-b">
        <TabButton active={mode === "manual"} onClick={() => onModeChange("manual")}>Captura manual</TabButton>
        <TabButton active={mode === "cfdi"} onClick={() => onModeChange("cfdi")}>Cargar XML CFDI</TabButton>
      </div>
      <div className="p-4">
        {mode === "cfdi" && (
          <CargaXmlNcSection parsed={parsedCfdi} onParsed={onCfdiParsed} />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-folio">Folio NC *</Label>
            <Input id="nc-folio" value={folio} onChange={(e) => onFolioChange(e.target.value)} placeholder="NC-001" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-fecha">Fecha *</Label>
            <DatePickerMx value={fecha} onChange={onFechaChange} className="w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          <div className="space-y-1.5">
            <Label htmlFor="nc-monto">Monto *</Label>
            <Input
              id="nc-monto" type="number" step="0.01" min="0.01"
              max={moneda === monedaFactura ? saldoFactura : undefined}
              value={monto} onChange={(e) => onMontoChange(e.target.value)} placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Moneda de la NC *</Label>
            <Select value={moneda} onValueChange={(v) => onMonedaChange(v as MonedaNC)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONEDAS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}{m === monedaFactura ? " (moneda de la factura)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {moneda !== monedaFactura && (
          <div className="space-y-1.5 mt-3">
            <Label htmlFor="nc-tc">Tipo de cambio (MXN por 1 {monedaExtranjera})</Label>
            <Input
              id="nc-tc" type="number" step="0.0001" min="0"
              value={tipoCambio} onChange={(e) => onTipoCambioChange(e.target.value)}
              placeholder="Ej. 18.5000"
            />
            <p className="text-label text-muted-foreground">
              Si lo dejas vacío se usa el tipo de cambio del DOF de la fecha de la NC.
            </p>
          </div>
        )}
        <div className="space-y-1.5 mt-3">
          <Label>Motivo *</Label>
          <Select value={motivo} onValueChange={(v) => onMotivoChange(v as MotivoNC)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOTIVOS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 mt-3">
          <Label htmlFor="nc-desc">Descripción</Label>
          <Textarea id="nc-desc" value={descripcion} onChange={(e) => onDescripcionChange(e.target.value)} rows={3} />
        </div>
      </div>
    </div>
  );
}
