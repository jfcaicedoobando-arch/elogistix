import { Badge } from "@/components/ui/badge";
import {
  etiquetaTratamientoFila,
  type FilaTratamiento,
} from "@/lib/financial/etiquetaTratamientoFila";

interface Props {
  concepto: FilaTratamiento;
}

export function TratamientoIvaBadge({ concepto }: Props) {
  return (
    <Badge variant="outline" className="ml-2 text-body-sm">
      {etiquetaTratamientoFila(concepto)}
    </Badge>
  );
}