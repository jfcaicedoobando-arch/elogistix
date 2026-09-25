/**
 * Tratamiento de IVA de una línea de cotización — SIEMPRE explícito.
 *
 * Ya no existe un interruptor de "IVA apagado" ni un selector de tasa suelto:
 * ante el SAT, "no paga IVA" puede ser tasa 0% (Art. 29 LIVA), exento o no
 * objeto (ObjetoImp 01), y esas categorías no se deducen unas de otras. El
 * usuario elige el tratamiento y la tasa se deriva de él.
 *
 * El 8% de la región fronteriza es un estímulo fiscal: queda deshabilitado
 * mientras Contabilidad no lo active en Configuración → Facturación y, cuando
 * está activo, exige confirmación explícita.
 */
import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Hint } from "@/components/shared/Hint";
import {
  TIPO_IVA_AYUDA,
  TIPO_IVA_AYUDA_GENERAL,
  TIPO_IVA_LABEL_CORTO,
  TIPO_IVA_OPCIONES,
  esTipoIvaSat,
  type TipoIvaSat,
} from "@/lib/financial/tipoIvaSat";
import {
  AVISO_IVA_FRONTERA_DESHABILITADO,
  AVISO_IVA_FRONTERA_TEXTO,
  AVISO_IVA_FRONTERA_TITULO,
  URL_SAT_IVA_FRONTERA,
  tipoIvaSeleccionable,
} from "@/lib/financial/ivaFrontera";
import { useIvaFronteraHabilitada } from "@/features/configuracion";
import { cn } from "@/lib/utils";

export const AVISO_TRATAMIENTO_POR_DEFINIR = "Tratamiento fiscal por definir";
export const ETIQUETA_TRATAMIENTO_IVA = "Tratamiento de IVA";

interface Props {
  tipoIva?: string | null;
  onTipoIvaChange: (tipo: TipoIvaSat) => void;
}

export function SelectTratamientoIvaFila({ tipoIva, onTipoIvaChange }: Props) {
  const fronteraHabilitada = useIvaFronteraHabilitada();
  const [confirmarFrontera, setConfirmarFrontera] = useState(false);
  const actual = esTipoIvaSat(tipoIva) ? tipoIva : undefined;
  const pendiente = actual === undefined;

  const elegir = (valor: string) => {
    // Defensa en profundidad: la opción ya viene deshabilitada, pero el
    // callback tampoco acepta el 8% con el estímulo apagado.
    if (!tipoIvaSeleccionable(valor, fronteraHabilitada)) return;
    if (valor === "gravado_8") {
      setConfirmarFrontera(true);
      return;
    }
    onTipoIvaChange(valor as TipoIvaSat);
  };

  return (
    <>
      <Hint
        label={
          pendiente
            ? `${AVISO_TRATAMIENTO_POR_DEFINIR}: elige cómo se declara este concepto ante el SAT. ${TIPO_IVA_AYUDA_GENERAL}`
            : TIPO_IVA_AYUDA[actual]
        }
      >
        <Select value={actual ?? ""} onValueChange={elegir}>
          <SelectTrigger
            className={cn(
              "h-10",
              pendiente && "border-warning/60 bg-warning/15 text-foreground dark:bg-warning/20",
            )}
            aria-label={pendiente ? AVISO_TRATAMIENTO_POR_DEFINIR : ETIQUETA_TRATAMIENTO_IVA}
          >
            <span className="flex items-center gap-1 truncate text-body-sm">
              {pendiente && <AlertTriangle className="size-3.5 shrink-0 text-warning" />}
              {pendiente ? "Por definir" : TIPO_IVA_LABEL_CORTO[actual]}
            </span>
          </SelectTrigger>
          <SelectContent className={pendiente ? "border-warning/30" : undefined}>
            {TIPO_IVA_OPCIONES.map((o) => {
              const habilitada = tipoIvaSeleccionable(o.value, fronteraHabilitada);
              return (
                <Hint key={o.value} label={habilitada ? undefined : AVISO_IVA_FRONTERA_DESHABILITADO}>
                  <SelectItem
                    value={o.value}
                    disabled={!habilitada}
                    className="group data-[highlighted]:bg-selection data-[highlighted]:text-selection-foreground data-[state=checked]:bg-selection data-[state=checked]:text-selection-foreground data-[disabled]:opacity-100 data-[disabled]:text-muted-foreground"
                  >
                    <span className="flex flex-col">
                      <span>{o.label}</span>
                      <span className="text-label text-muted-foreground group-data-[highlighted]:text-selection-foreground group-data-[state=checked]:text-selection-foreground">
                        {habilitada ? TIPO_IVA_AYUDA[o.value] : AVISO_IVA_FRONTERA_DESHABILITADO}
                      </span>
                    </span>
                  </SelectItem>
                </Hint>
              );
            })}
          </SelectContent>
        </Select>
      </Hint>

      <AlertDialog open={confirmarFrontera} onOpenChange={setConfirmarFrontera}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{AVISO_IVA_FRONTERA_TITULO}</AlertDialogTitle>
            <AlertDialogDescription>
              {AVISO_IVA_FRONTERA_TEXTO}{" "}
              <a href={URL_SAT_IVA_FRONTERA} target="_blank" rel="noopener noreferrer" className="underline">
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
                onTipoIvaChange("gravado_8");
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
