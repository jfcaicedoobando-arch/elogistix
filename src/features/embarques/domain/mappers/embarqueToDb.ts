/**
 * Mapeo desde el formulario de embarque (RHF) hacia payloads de inserción en BD.
 *
 * Validación runtime (P1.7): los enums (`modo`, `tipo`, `incoterm`,
 * `tipoServicio`, `moneda`) se validan con Zod antes de enviar a Supabase
 * para dar errores claros en vez de propagar valores inválidos al backend.
 *
 * Las piezas del payload (base, por modo de transporte, financieras,
 * heredadas de cotización) viven en `embarqueToDbPartes.ts`; los conceptos de
 * venta/costo en `embarqueToDbConceptos.ts` (Power-of-10).
 */

import type { TablesInsert } from "@/integrations/supabase/types";
import type { EmbarqueFormValues } from "./embarqueFromDb";
import {
  type ContactoRow,
  partesBase,
  partesMaritimo,
  totalesDesdeContenedores,
  partesAereo,
  partesTerrestre,
  partesFinancieras,
  partesHerencia,
} from "./embarqueToDbPartes";

export type { ContactoRow };
export { buildConceptosVentaPayload, buildConceptosCostoPayload } from "./embarqueToDbConceptos";

type EmbarqueInsert = Omit<TablesInsert<"embarques">, "expediente">;

/** Mapea valores del formulario al payload de inserción en BD. */
export function buildEmbarquePayload(
  values: EmbarqueFormValues,
  contactos: ContactoRow[],
  clienteNombre: string,
  operador: string,
): EmbarqueInsert {
  return {
    ...partesBase(values, contactos, clienteNombre),
    ...partesMaritimo(values),
    ...partesAereo(values),
    ...partesTerrestre(values),
    ...partesFinancieras(values),
    ...partesHerencia(values),
    ...totalesDesdeContenedores(values),
    operador,
  } as EmbarqueInsert;
}
