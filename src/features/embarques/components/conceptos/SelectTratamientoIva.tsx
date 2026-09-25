/**
 * Selector de tratamiento de IVA por línea de venta del embarque.
 * Existe para clasificar conceptos heredados "Por definir" (fletes USD de
 * cotización sin IVA, embarques previos a `tipo_iva`) sin volver a elegir el
 * concepto del catálogo. Nunca infiere: el usuario elige explícitamente.
 */
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPO_IVA_OPCIONES, TIPO_IVA_LABEL_CORTO, esTipoIvaSat, tasaDeTipoIva, type TipoIvaSat } from "@/lib/financial/tipoIvaSat";
import { tratamientoIvaPendiente } from "@/lib/financial/etiquetaTratamientoFila";
import { cn } from "@/lib/utils";

export interface CambioTratamientoIva {
  tipoIva: TipoIvaSat;
  tasaIva: number;
  aplicaIva: boolean;
}

/** Deriva los tres campos de la línea a partir del tratamiento SAT elegido. */
export function cambioDesdeTipoIva(tipo: TipoIvaSat): CambioTratamientoIva {
  const tasa = tasaDeTipoIva(tipo);
  return { tipoIva: tipo, tasaIva: tasa ?? 0, aplicaIva: tasa != null && tasa > 0 };
}

interface Props {
  tipoIva?: string | null;
  aplicaIva?: boolean | null;
  tasaIva?: number | null;
  disabled?: boolean;
  onChange: (cambio: CambioTratamientoIva) => void;
}

export function SelectTratamientoIva({ tipoIva, aplicaIva, tasaIva, disabled, onChange }: Props) {
  const pendiente = tratamientoIvaPendiente({ tipo_iva: tipoIva, aplica_iva: aplicaIva, tasa_iva_aplicada: tasaIva });
  const value = esTipoIvaSat(tipoIva) ? tipoIva : undefined;
  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(v) => { if (esTipoIvaSat(v)) onChange(cambioDesdeTipoIva(v)); }}
    >
      <SelectTrigger
        aria-label="Tratamiento de IVA"
        data-testid={pendiente ? "tratamiento-iva-pendiente" : undefined}
        className={cn("h-8 text-caption", pendiente && "border-warning text-warning")}
      >
        <SelectValue placeholder={pendiente ? "IVA: Por definir" : "IVA: según tasa"}>
          {value ? `IVA: ${TIPO_IVA_LABEL_CORTO[value]}` : undefined}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {TIPO_IVA_OPCIONES.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
