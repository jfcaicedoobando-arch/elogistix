/** Origen del efectivo de una aplicación: el anticipo, no un segundo pago. */
export interface MovimientoAnticipoOrigen {
  id: string;
  fecha: string;
  referencia: string | null;
  cargo: number | string;
  abono: number | string | null;
  deleted_at?: string | null;
}
export interface AplicacionAnticipoOrigen {
  id: string;
  anticipo_id: string;
  deleted_at: string | null;
  anticipos_proveedor: {
    id: string;
    deleted_at: string | null;
    estado: string;
    moneda: string;
    metodo_pago: string | null;
    cuenta_bancaria_id: string | null;
    bbva_movimientos: MovimientoAnticipoOrigen[] | null;
  } | null;
}
export interface PagoConOrigenAnticipo {
  es_anticipo_aplicado?: boolean | null;
  anticipos_aplicaciones?: AplicacionAnticipoOrigen[] | null;
}
export interface OrigenPagoAnticipo {
  tipo: "bancario" | "efectivo" | "inconsistente";
  movimiento: MovimientoAnticipoOrigen | null;
  moneda: string | null;
}

export function esPagoAnticipo(pago: PagoConOrigenAnticipo): boolean {
  return pago.es_anticipo_aplicado === true || (pago.anticipos_aplicaciones ?? []).some((a) => !a.deleted_at);
}

/** La conciliación RPC valida importes y vínculos; esta vista no inventa cargos. */
export function origenPagoAnticipo(pago: PagoConOrigenAnticipo): OrigenPagoAnticipo | null {
  if (!esPagoAnticipo(pago)) return null;
  const aplicaciones = (pago.anticipos_aplicaciones ?? []).filter((a) => !a.deleted_at);
  const anticipo = aplicaciones.length === 1 ? aplicaciones[0].anticipos_proveedor : null;
  const inconsistente: OrigenPagoAnticipo = { tipo: "inconsistente", movimiento: null, moneda: null };
  if (!pago.es_anticipo_aplicado || !anticipo || anticipo.deleted_at || !anticipo.moneda || anticipo.estado.toLowerCase() === "cancelado") return inconsistente;
  const movimientos = (anticipo.bbva_movimientos ?? []).filter((m) => !m.deleted_at);
  if (anticipo.metodo_pago === "Efectivo") {
    return movimientos.length === 0 && !anticipo.cuenta_bancaria_id ? { tipo: "efectivo", movimiento: null, moneda: anticipo.moneda } : inconsistente;
  }
  // Devolver el saldo restante añade un abono legítimo al mismo anticipo.
  // Como la RPC, buscamos sólo su único cargo original, sin ocultar devoluciones.
  const cargos = movimientos.filter((m) => Number(m.cargo) > 0 && Number(m.abono ?? 0) === 0);
  if (!anticipo.cuenta_bancaria_id || cargos.length !== 1) return inconsistente;
  return { tipo: "bancario", movimiento: cargos[0], moneda: anticipo.moneda };
}
