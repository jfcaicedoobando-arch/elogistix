/**
 * Selector de TASA de IVA de una línea gravable (16%, 8% frontera, 0%).
 *
 * P2-IVA: la tasa de 8% es un estímulo fiscal de la región fronteriza, no una
 * tasa general. Por eso:
 *  - está deshabilitada mientras Contabilidad no active el estímulo en
 *    Configuración → Facturación (por omisión, deshabilitada);
 *  - cuando está activa, elegirla exige una confirmación explícita.
 * Las líneas ya guardadas al 8% se muestran tal cual: esta protección sólo
 * aplica a selecciones nuevas.
 */
import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Hint } from "@/components/shared/Hint";
import { TASAS_IVA_MX } from "@/lib/financial/financialUtils";
import {
  AVISO_IVA_FRONTERA_DESHABILITADO,
  AVISO_IVA_FRONTERA_TEXTO,
  AVISO_IVA_FRONTERA_TITULO,
  URL_SAT_IVA_FRONTERA,
  esTasaFrontera,
  tasaSeleccionable,
} from "@/lib/financial/ivaFrontera";
import { useIvaFronteraHabilitada } from "@/features/configuracion";

interface TasaIvaSelectProps {
  tasa: number;
  onTasaChange: (tasa: number) => void;
}

export function TasaIvaSelect({ tasa, onTasaChange }: TasaIvaSelectProps) {
  const fronteraHabilitada = useIvaFronteraHabilitada();
  const [confirmarFrontera, setConfirmarFrontera] = useState(false);

  const elegir = (valor: string) => {
    const nueva = Number(valor);
    if (esTasaFrontera(nueva)) {
      if (!fronteraHabilitada) return; // opción deshabilitada; nunca debería llegar
      setConfirmarFrontera(true);
      return;
    }
    onTasaChange(nueva);
  };

  return (
    <>
      <Select value={String(tasa)} onValueChange={elegir}>
        <SelectTrigger className="h-10" aria-label="Tasa de IVA">
          {Math.round(tasa * 100)}%
        </SelectTrigger>
        <SelectContent>
          {TASAS_IVA_MX.map((opcion) => {
            const habilitada = tasaSeleccionable(opcion.value, fronteraHabilitada);
            return (
              <Hint
                key={opcion.value}
                label={habilitada ? undefined : AVISO_IVA_FRONTERA_DESHABILITADO}
              >
                <SelectItem value={String(opcion.value)} disabled={!habilitada}>
                  {opcion.label}
                </SelectItem>
              </Hint>
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
              <a
                href={URL_SAT_IVA_FRONTERA}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Consultar la información oficial del SAT
              </a>
              .
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmarFrontera(false);
                onTasaChange(0.08);
              }}
            >
              Confirmo la elegibilidad
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
