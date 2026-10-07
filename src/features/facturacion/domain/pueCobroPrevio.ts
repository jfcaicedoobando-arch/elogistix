/** Evidencia de cobros vigentes, nunca un saldo inferido ni el estado almacenado. */
export interface EvidenciaCobroPue { metodo_pago?: string | null; pagado?: number | null }

export function errorCobroPuePrevio(f: EvidenciaCobroPue): string | null {
  if (f.metodo_pago !== "PUE") return null;
  if (f.pagado == null || !Number.isFinite(f.pagado) || f.pagado < 0) {
    return "No se pudo verificar si esta factura PUE tiene un cobro previo. Actualiza la cartera antes de cobrar.";
  }
  return f.pagado > 0
    ? "Esta factura PUE ya tiene un cobro vigente. Revisa el pago previo con Cobranza; no admite una segunda exhibición."
    : null;
}
