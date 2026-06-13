/**
 * Funciones puras de cxc-recordatorios extraídas para ser testeables sin
 * importar `index.ts` (que ejecuta `Deno.serve` al cargarse).
 */

export interface FacturaRow {
  id: string;
  numero: string;
  cliente_id: string;
  cliente_nombre: string;
  total: number;
  moneda: string;
  fecha_vencimiento: string;
  pagos_factura: Array<{ monto_aplicado_factura: number; deleted_at: string | null }> | null;
  factura_notas_credito: Array<{ monto: number; estado: string; deleted_at: string | null }> | null;
}

export function ventana(diasParaVencer: number): "T-3" | "T+7" | "T+15" | null {
  if (diasParaVencer === -3) return "T-3";
  if (diasParaVencer === 7) return "T+7";
  if (diasParaVencer === 15) return "T+15";
  return null;
}

export function buildBucketEntry(f: FacturaRow, saldo: number, dias: number) {
  return {
    factura_id: f.id,
    numero: f.numero,
    cliente_id: f.cliente_id,
    cliente_nombre: f.cliente_nombre,
    saldo,
    moneda: f.moneda,
    fecha_vencimiento: f.fecha_vencimiento,
    dias,
  };
}

export function calcularSaldoFactura(f: FacturaRow): number {
  const pagado = (f.pagos_factura ?? [])
    .filter((p) => !p.deleted_at)
    .reduce((s, p) => s + Number(p.monto_aplicado_factura), 0);
  const nc = (f.factura_notas_credito ?? [])
    .filter((n) => !n.deleted_at && n.estado === "Aplicada")
    .reduce((s, n) => s + Number(n.monto), 0);
  return Math.max(0, Number(f.total) - pagado - nc);
}

export function diasParaVencer(fechaVenc: string, hoy: Date): number {
  const venc = new Date(fechaVenc + "T00:00:00Z");
  return Math.floor((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
}
