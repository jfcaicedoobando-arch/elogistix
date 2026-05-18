import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CONCEPTOS_COSTO_USD, CONCEPTOS_CON_IVA_USD } from "@/constants/cotizacionConstants";

function getConceptoSelectValue(descripcion: string, catalogo: readonly string[]): string {
  if (catalogo.includes(descripcion)) return descripcion;
  if (descripcion === "") return "";
  return "Otro";
}

interface Props {
  descripcion: string;
  index: number;
  actualizar: (index: number, campo: string, valor: string | number | boolean) => void;
}

export function ConceptoDescripcionSelector({ descripcion, index, actualizar }: Props) {
  const catalogo = CONCEPTOS_COSTO_USD as readonly string[];
  const ivaSet = CONCEPTOS_CON_IVA_USD as readonly string[];
  const esLibre = descripcion !== '' && !catalogo.includes(descripcion) && descripcion !== 'Otro';

  if (esLibre) {
    return (
      <Input
        value={descripcion}
        onChange={e => actualizar(index, 'descripcion', e.target.value)}
        placeholder="Descripción libre"
      />
    );
  }
  return (
    <Select
      value={getConceptoSelectValue(descripcion, catalogo)}
      onValueChange={val => {
        if (val === 'Otro') {
          actualizar(index, 'descripcion', '');
          actualizar(index, 'aplica_iva', false);
          setTimeout(() => actualizar(index, '_esOtro', true), 0);
        } else {
          actualizar(index, 'descripcion', val);
          actualizar(index, 'aplica_iva', ivaSet.includes(val));
        }
      }}
    >
      <SelectTrigger><SelectValue placeholder="Selecciona concepto" /></SelectTrigger>
      <SelectContent>
        {[...catalogo].map(opt => (
          <SelectItem key={opt} value={opt}>
            {ivaSet.includes(opt) ? `${opt} *` : opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
