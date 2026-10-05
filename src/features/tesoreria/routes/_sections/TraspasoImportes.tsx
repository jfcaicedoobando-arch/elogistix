/**
 * Sección "Importes y fecha" del modal de traspaso entre cuentas propias.
 * Extraída para mantener el modal bajo 200 líneas (Power of 10).
 */
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { DatePickerMx } from "@/components/ui/date-picker-mx";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { formatDate } from "@/lib/formatters";
import { hoyMx } from "@/lib/date/mx";

interface TraspasoImportesProps {
  fecha: string;
  fechaMinima?: string;
  corteOrigen?: string;
  corteDestino?: string;
  errorFecha?: string | null;
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
  fecha, fechaMinima, corteOrigen, corteDestino, errorFecha, montoOrigen, comision, monedaOrigen,
  onFechaChange, onMontoChange, onComisionChange, onCaptura, capturasNegativas,
}: TraspasoImportesProps) {
  // El raw y MoneyInput se procesan en el mismo evento change. Capturar input
  // puede restaurar el DOM controlado antes de que React procese onChange.
  const capturar = (campo: "montoOrigen" | "comision", target: EventTarget) => {
    if (target instanceof HTMLInputElement) onCaptura(campo, target.value);
  };
  return (
    <FormDialogSection title="Importes y fecha">
      <div className="space-y-1.5">
        <Label htmlFor="traspaso-fecha">Fecha</Label>
        <DatePickerMx id="traspaso-fecha" value={fecha} onChange={onFechaChange}
          min={fechaMinima} max={hoyMx()} errorText={errorFecha} />
        {fechaMinima && <div className="text-body-sm text-muted-foreground" aria-live="polite">
          {corteOrigen && <p>Corte de cuenta origen: {formatDate(corteOrigen)}.</p>}
          {corteDestino && <p>Corte de cuenta destino: {formatDate(corteDestino)}.</p>}
          <p>Fecha mínima permitida: {formatDate(fechaMinima)} (inclusive).</p>
        </div>}
      </div>
      <div className="space-y-1.5" onChangeCapture={(e) => capturar("montoOrigen", e.target)}>
        <Label htmlFor="traspaso-monto">Monto transferido</Label>
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
      <div className="space-y-1.5" onChangeCapture={(e) => capturar("comision", e.target)}>
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
