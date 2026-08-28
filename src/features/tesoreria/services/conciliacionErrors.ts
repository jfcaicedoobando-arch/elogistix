/**
 * Errores tipados de conciliación bancaria.
 *
 * S.1 (N-1): la guarda de BD `assert_movimiento_pago_consistente` valida
 * org/moneda/duplicidad; aquí se traducen sus códigos a un error de dominio.
 * Separado de `conciliacion.ts` por límite de tamaño (Power of 10).
 */
export class MovimientoVinculoError extends Error {
  constructor(
    public readonly code:
      | "LC_MOVIMIENTO_ORG_MISMATCH"
      | "LC_MOVIMIENTO_DIVISA_MISMATCH"
      | "LC_MOVIMIENTO_DOBLE_VINCULO"
      | "LC_MOVIMIENTO_PAGO_INEXISTENTE"
      | "LC_MOVIMIENTO_YA_VINCULADO"
      | "LC_MOVIMIENTO_MONTO_MISMATCH",
    message: string,
  ) {
    super(message);
    this.name = "MovimientoVinculoError";
  }
}

export function mapConciliacionError(err: { code?: string; message?: string } | null): never {
  const msg = err?.message ?? "";
  // Índices únicos parciales uq_bbva_movimientos_pago_{factura,proveedor}
  if (err?.code === "23505" && /uq_bbva_movimientos_pago_/.test(msg)) {
    throw new MovimientoVinculoError(
      "LC_MOVIMIENTO_YA_VINCULADO",
      "Este pago ya fue vinculado a otro movimiento bancario. Desconcilia el movimiento anterior antes de reasignarlo.",
    );
  }
  for (const code of [
    "LC_MOVIMIENTO_ORG_MISMATCH",
    "LC_MOVIMIENTO_DIVISA_MISMATCH",
    "LC_MOVIMIENTO_DOBLE_VINCULO",
    "LC_MOVIMIENTO_PAGO_INEXISTENTE",
    "LC_MOVIMIENTO_MONTO_MISMATCH",
  ] as const) {
    if (msg.includes(code)) {
      const detalle = msg.split(":").slice(1).join(":").trim() || msg;
      throw new MovimientoVinculoError(code, detalle);
    }
  }
  throw err as Error;
}
