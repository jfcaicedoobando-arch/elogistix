/**
 * Selector de tratamiento fiscal de IVA para la captura de renglones de factura.
 *
 * P1 · Auditoría IVA — el 8% de región fronteriza es un ESTÍMULO sujeto a aviso
 * ante el SAT: si la organización no lo tiene habilitado, aquí se deshabilita
 * con explicación (antes se podía capturar y el bloqueo aparecía sólo al
 * timbrar). Un renglón que YA venía al 8% conserva su tratamiento: no se
 * reescribe lo histórico.
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AVISO_IVA_FRONTERA_DESHABILITADO,
  TIPO_IVA_FRONTERA,
  puedeGuardarTipoIva,
} from "@/lib/financial/ivaFrontera";
import type { TipoIvaConcepto } from "@/features/facturacion/services/conceptosFacturaCrud";

export const TIPO_IVA_LABEL: Record<TipoIvaConcepto, string> = {
  gravado_16: "IVA 16%",
  gravado_8: "IVA 8% (frontera)",
  tasa_0: "Tasa 0%",
  exento: "Exento",
  no_objeto: "No objeto de impuesto (SAT 01)",
};

const ORDEN: readonly TipoIvaConcepto[] = [
  "gravado_16", "gravado_8", "tasa_0", "exento", "no_objeto",
];

/** `true` cuando el tratamiento elegido no puede guardarse (8% deshabilitado). */
export function frontera8Bloqueado(
  tipo: TipoIvaConcepto | undefined,
  tipoOriginal: TipoIvaConcepto | null | undefined,
  fronteraHabilitada: boolean,
): boolean {
  if (!tipo) return false;
  return !puedeGuardarTipoIva(tipo, tipoOriginal, fronteraHabilitada);
}

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
        {ORDEN.map((tipo) => (
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
