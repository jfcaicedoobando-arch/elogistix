/**
 * Sección "Importes y fecha" del modal de traspaso entre cuentas propias.
 * Extraída para mantener el modal bajo 200 líneas (Power of 10).
 */
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { FormDialogSection } from "@/components/shared/FormDialogSection";

interface TraspasoImportesProps {
  fecha: string;
  montoOrigen: number;
  comision: number;
  monedaOrigen?: string;
  onFechaChange: (v: string) => void;
  onMontoChange: (v: number) => void;
  onComisionChange: (v: number) => void;
  onCaptura: (campo: "montoOrigen" | "comision", raw: string) => void;
  capturasNegativas: { montoOrigen: boolean; comision: boolean };
}

export function TraspasoImportes({
  fecha, montoOrigen, comision, monedaOrigen,
  onFechaChange, onMontoChange, onComisionChange, onCaptura, capturasNegativas,
}: TraspasoImportesProps) {
  const capturar = (campo: "montoOrigen" | "comision", target: EventTarget) => {
    if (target instanceof HTMLInputElement) onCaptura(campo, target.value);
  };
  return (
    <FormDialogSection title="Importes y fecha">
      <div className="space-y-1.5">
        <Label htmlFor="traspaso-fecha">Fecha</Label>
        <DatePickerMx id="traspaso-fecha" value={fecha} onChange={onFechaChange} />
      </div>
      <div className="space-y-1.5" onInputCapture={(e) => capturar("montoOrigen", e.target)}>
        <Label htmlFor="traspaso-monto">Monto a transferir</Label>
        <MoneyInput
          id="traspaso-monto"
          value={montoOrigen}
          onChange={onMontoChange}
          currency={monedaOrigen}
          allowNegative
          aria-invalid={capturasNegativas.montoOrigen || montoOrigen < 0}
          aria-describedby={capturasNegativas.montoOrigen || montoOrigen < 0 ? "traspaso-monto-error" : undefined}
        />
        {(capturasNegativas.montoOrigen || montoOrigen < 0) && <p id="traspaso-monto-error" role="alert" className="text-body-sm text-destructive">
          Corrige el monto negativo; no se cambiará el signo para registrarlo.
        </p>}
      </div>
      <div className="space-y-1.5" onInputCapture={(e) => capturar("comision", e.target)}>
        <Label htmlFor="traspaso-comision">Comisión bancaria (opcional)</Label>
        <MoneyInput
          id="traspaso-comision"
          value={comision}
          onChange={onComisionChange}
          currency={monedaOrigen}
          allowNegative
          aria-invalid={capturasNegativas.comision || comision < 0}
          aria-describedby={capturasNegativas.comision || comision < 0 ? "traspaso-comision-error" : undefined}
        />
        {(capturasNegativas.comision || comision < 0) && <p id="traspaso-comision-error" role="alert" className="text-body-sm text-destructive">
          La comisión no puede ser negativa. Corrige la captura para continuar.
        </p>}
      </div>
    </FormDialogSection>
  );
}
