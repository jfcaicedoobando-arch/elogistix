/**
 * Selector de tratamiento fiscal de IVA para la captura de renglones de factura.
 *
 * P1 · Auditoría IVA — el 8% de región fronteriza es un ESTÍMULO sujeto a aviso
 * ante el SAT: si la organización no lo tiene habilitado, aquí se deshabilita
 * con explicación (antes se podía capturar y el bloqueo aparecía sólo al
 * timbrar). Un renglón que YA venía al 8% conserva su tratamiento: no se
 * reescribe lo histórico.
 *
 * Las etiquetas y la regla `frontera8Bloqueado` viven en `facturaTipoIva.ts`
 * para que este archivo sólo exporte el componente (fast refresh).
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AVISO_IVA_FRONTERA_DESHABILITADO,
  TIPO_IVA_FRONTERA,
  puedeGuardarTipoIva,
} from "@/lib/financial/ivaFrontera";
import { ORDEN_TIPOS_IVA, TIPO_IVA_LABEL } from "./facturaTipoIva";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";

interface Props {
  value: TipoIvaConcepto | undefined;
  tipoOriginal?: TipoIvaConcepto | null;
  fronteraHabilitada: boolean;
  placeholder: string;
  onChange: (tipo: TipoIvaConcepto) => void;
}

export function FacturaTipoIvaSelect({
  value, tipoOriginal, fronteraHabilitada, placeholder, onChange,
}: Props) {
  const bloqueado = (tipo: TipoIvaConcepto) =>
    tipo === TIPO_IVA_FRONTERA && !puedeGuardarTipoIva(tipo, tipoOriginal, fronteraHabilitada);
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const tipo = v as TipoIvaConcepto;
        if (bloqueado(tipo)) return;
        onChange(tipo);
      }}
    >
      <SelectTrigger className="h-9" aria-label="Tratamiento de IVA">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {ORDEN_TIPOS_IVA.map((tipo) => (
          <SelectItem
            key={tipo}
            value={tipo}
            disabled={bloqueado(tipo)}
            title={bloqueado(tipo) ? AVISO_IVA_FRONTERA_DESHABILITADO : undefined}
          >
            {TIPO_IVA_LABEL[tipo]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
