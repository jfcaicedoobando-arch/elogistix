import { labelExpediente } from "@/lib/domain/labelExpediente";
import type { CxpPorCapturarRow } from "../services/bandejas";

export function referenciaCxpEmbarque(row: CxpPorCapturarRow): string {
  // Falta de permisos/metadata no acredita que la operación sea un borrador.
  return labelExpediente(row.expediente, row.embarque_id, row.estado_embarque ?? "Desconocido");
}
