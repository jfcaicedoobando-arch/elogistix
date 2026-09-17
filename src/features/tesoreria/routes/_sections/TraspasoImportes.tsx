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
}

export function TraspasoImportes({
  fecha, montoOrigen, comision, monedaOrigen,
  onFechaChange, onMontoChange, onComisionChange,
}: TraspasoImportesProps) {
  return (
    <FormDialogSection title="Importes y fecha">
      <div className="space-y-1.5">
        <Label htmlFor="traspaso-fecha">Fecha</Label>
        <DatePickerMx id="traspaso-fecha" value={fecha} onChange={onFechaChange} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="traspaso-monto">Monto a transferir</Label>
        <MoneyInput
          id="traspaso-monto"
          value={montoOrigen}
          onChange={onMontoChange}
          currency={monedaOrigen}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="traspaso-comision">Comisión bancaria (opcional)</Label>
        <MoneyInput
          id="traspaso-comision"
          value={comision}
          onChange={onComisionChange}
          currency={monedaOrigen}
        />
      </div>
    </FormDialogSection>
  );
}
