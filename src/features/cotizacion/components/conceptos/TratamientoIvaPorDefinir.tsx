/**
 * P2-IVA — Estado "Tratamiento fiscal por definir".
 *
 * Una línea sin `tipo_iva` (o con un valor no reconocido) NO se puede
 * clasificar: el timbrado la bloquea después. Antes mostraba una tasa normal,
 * como si estuviera resuelta. Aquí se muestra el aviso y la acción para
 * definirla explícitamente. Nunca se deriva exento / tasa 0% / no objeto de la
 * tasa ni del interruptor `aplica_iva`.
 *
 * P2-IVA (seguimiento): el 8% de la región fronteriza es un estímulo fiscal.
 * Mientras Contabilidad no lo habilite por organización, esa opción queda
 * deshabilitada y el callback la rechaza (defensa en profundidad).
 */
import { AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Hint } from "@/components/shared/Hint";
import {
  TIPO_IVA_AYUDA,
  TIPO_IVA_AYUDA_GENERAL,
  TIPO_IVA_OPCIONES,
  type TipoIvaSat,
} from "@/lib/financial/tipoIvaSat";
import {
  AVISO_IVA_FRONTERA_DESHABILITADO,
  tipoIvaSeleccionable,
} from "@/lib/financial/ivaFrontera";
import { useIvaFronteraHabilitada } from "@/features/configuracion";

export const AVISO_TRATAMIENTO_POR_DEFINIR = "Tratamiento fiscal por definir";

interface Props {
  onTipoIvaChange: (tipo: TipoIvaSat) => void;
}

export function TratamientoIvaPorDefinir({ onTipoIvaChange }: Props) {
  const fronteraHabilitada = useIvaFronteraHabilitada();

  const elegir = (valor: string) => {
    // Defensa en profundidad: la opción ya viene deshabilitada, pero el
    // callback tampoco acepta el 8% con el estímulo apagado.
    if (!tipoIvaSeleccionable(valor, fronteraHabilitada)) return;
    onTipoIvaChange(valor as TipoIvaSat);
  };

  return (
    <Hint
      label={`${AVISO_TRATAMIENTO_POR_DEFINIR}: elige cómo se declara este concepto ante el SAT. ${TIPO_IVA_AYUDA_GENERAL}`}
    >
      <Select value="" onValueChange={elegir}>
        <SelectTrigger
          className="h-10 border-warning text-warning-foreground bg-warning/10"
          aria-label={AVISO_TRATAMIENTO_POR_DEFINIR}
        >
          <span className="flex items-center gap-1 truncate text-body-sm">
            <AlertTriangle className="size-3.5 shrink-0" />
            Por definir
          </span>
        </SelectTrigger>
        <SelectContent>
          {TIPO_IVA_OPCIONES.map((o) => {
            const habilitada = tipoIvaSeleccionable(o.value, fronteraHabilitada);
            return (
              <Hint
                key={o.value}
                label={habilitada ? undefined : AVISO_IVA_FRONTERA_DESHABILITADO}
              >
                <SelectItem value={o.value} disabled={!habilitada}>
                  <span className="flex flex-col">
                    <span>{o.label}</span>
                    <span className="text-label text-muted-foreground">
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
  );
}
