/**
 * Selector de tratamiento de IVA por línea de venta del embarque.
 * Existe para clasificar conceptos heredados "Por definir" (fletes USD de
 * cotización sin IVA, embarques previos a `tipo_iva`) sin volver a elegir el
 * concepto del catálogo. Nunca infiere: el usuario elige explícitamente.
 */
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useIvaFronteraHabilitada } from "@/features/configuracion";
import {
  AVISO_IVA_FRONTERA_DESHABILITADO, AVISO_IVA_FRONTERA_TEXTO,
  AVISO_IVA_FRONTERA_TITULO, URL_SAT_IVA_FRONTERA, tipoIvaSeleccionable,
} from "@/lib/financial/ivaFrontera";
import { TIPO_IVA_OPCIONES, TIPO_IVA_LABEL_CORTO, esTipoIvaSat } from "@/lib/financial/tipoIvaSat";
import { tratamientoIvaPendiente } from "@/lib/financial/etiquetaTratamientoFila";
import { cn } from "@/lib/utils";
import { cambioDesdeTipoIva, type CambioTratamientoIva } from "@/features/embarques/domain/cambioTratamientoIva";

interface Props {
  tipoIva?: string | null;
  aplicaIva?: boolean | null;
  tasaIva?: number | null;
  disabled?: boolean;
  onChange: (cambio: CambioTratamientoIva) => void;
}

export function SelectTratamientoIva({ tipoIva, aplicaIva, tasaIva, disabled, onChange }: Props) {
  const fronteraHabilitada = useIvaFronteraHabilitada();
  const [confirmarFrontera, setConfirmarFrontera] = useState(false);
  const pendiente = tratamientoIvaPendiente({ tipo_iva: tipoIva, aplica_iva: aplicaIva, tasa_iva_aplicada: tasaIva });
  const value = esTipoIvaSat(tipoIva) ? tipoIva : undefined;
  const elegir = (valor: string) => {
    if (disabled || !esTipoIvaSat(valor) || !tipoIvaSeleccionable(valor, fronteraHabilitada)) return;
    if (valor === "gravado_8") {
      setConfirmarFrontera(true);
      return;
    }
    onChange(cambioDesdeTipoIva(valor));
  };

  return (
    <>
    <Select
      value={value}
      disabled={disabled}
      onValueChange={elegir}
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
        {TIPO_IVA_OPCIONES.map((o) => {
          const habilitada = tipoIvaSeleccionable(o.value, fronteraHabilitada);
          return (
            <SelectItem key={o.value} value={o.value} disabled={!habilitada}
              className="data-[disabled]:opacity-100 data-[disabled]:text-muted-foreground">
              <span className="flex flex-col">
                <span>{o.label}</span>
                {!habilitada && <span className="text-label">{AVISO_IVA_FRONTERA_DESHABILITADO}</span>}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
    <AlertDialog open={confirmarFrontera} onOpenChange={setConfirmarFrontera}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{AVISO_IVA_FRONTERA_TITULO}</AlertDialogTitle>
          <AlertDialogDescription>
            {AVISO_IVA_FRONTERA_TEXTO}{" "}
            <a href={URL_SAT_IVA_FRONTERA} target="_blank" rel="noopener noreferrer" className="underline">
              Consultar la información oficial del SAT
            </a>.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={() => {
            setConfirmarFrontera(false);
            // Revalidar al confirmar: el estado de la fila/configuración puede cambiar con el diálogo abierto.
            if (!disabled && fronteraHabilitada) onChange(cambioDesdeTipoIva("gravado_8"));
          }}>
            Confirmo la elegibilidad
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
