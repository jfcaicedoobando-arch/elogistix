import type { Tables } from "@/integrations/supabase/types";

export type MovimientoTraspaso = Pick<Tables<"bbva_movimientos">,
  "id" | "fecha" | "cuenta_bancaria_id" | "cargo" | "abono" | "hash_dedupe" | "estado_conciliacion">;
export type CuentaTraspasoDetalle = Pick<Tables<"cuentas_bancarias">, "id" | "alias" | "banco" | "moneda">;
export interface TraspasoDetalle {
  traspaso: Pick<Tables<"traspasos_bancarios">,
    "id" | "folio" | "fecha" | "cuenta_origen_id" | "cuenta_destino_id" | "moneda_origen" | "moneda_destino"
    | "monto_origen" | "monto_destino" | "comision" | "tipo_cambio" | "concepto" | "referencia" | "estado">;
  origen: CuentaTraspasoDetalle | null;
  destino: CuentaTraspasoDetalle | null;
  movimientos: MovimientoTraspaso[];
}

/** Las tres patas generadas comparten traspaso_id y hashes de rol canónicos. */
export function papelMovimientoTraspaso(id: string, movimiento: MovimientoTraspaso): string {
  const roles: Record<string, string> = { origen: "Salida", destino: "Entrada", comision: "Comisión" };
  const prefijo = `traspaso-${id}-`;
  return movimiento.hash_dedupe.startsWith(prefijo)
    ? roles[movimiento.hash_dedupe.slice(prefijo.length)] ?? "Movimiento del traspaso"
    : "Movimiento del traspaso";
}
