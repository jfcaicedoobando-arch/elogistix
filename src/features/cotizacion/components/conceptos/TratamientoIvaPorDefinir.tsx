/**
 * P2-IVA — Estado "Tratamiento fiscal por definir".
 *
 * Una línea sin `tipo_iva` (o con un valor no reconocido) NO se puede
 * clasificar: el timbrado la bloquea después. Antes mostraba una tasa normal,
 * como si estuviera resuelta. Aquí se muestra el aviso y la acción para
 * definirla explícitamente. Nunca se deriva exento / tasa 0% / no objeto de la
 * tasa ni del interruptor `aplica_iva`.
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

export const AVISO_TRATAMIENTO_POR_DEFINIR = "Tratamiento fiscal por definir";

interface Props {
  onTipoIvaChange: (tipo: TipoIvaSat) => void;
}

export function TratamientoIvaPorDefinir({ onTipoIvaChange }: Props) {
  return (
    <Hint
      label={`${AVISO_TRATAMIENTO_POR_DEFINIR}: elige cómo se declara este concepto ante el SAT. ${TIPO_IVA_AYUDA_GENERAL}`}
    >
      <Select value="" onValueChange={(v) => onTipoIvaChange(v as TipoIvaSat)}>
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
          {TIPO_IVA_OPCIONES.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              <span className="flex flex-col">
                <span>{o.label}</span>
                <span className="text-xs text-muted-foreground">{TIPO_IVA_AYUDA[o.value]}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Hint>
  );
}
