import { FORMAS_PAGO_SAT } from "@/constants/catalogosSAT";

/** Un cobro recibido requiere forma efectiva; 99 sólo describe una promesa. */
export const FORMAS_COBRO_SAT = FORMAS_PAGO_SAT.filter((f) => f.value !== "99");
export const ERROR_FORMA_COBRO = "Selecciona la forma efectiva del cobro. 99 (Por definir) no es válida para un complemento de pago.";
export function formaPagoCobroValida(forma: string | undefined): boolean {
  return FORMAS_COBRO_SAT.some((f) => f.value === forma);
}
