import type { FilaProyeccion, GrupoProyeccion } from "./types";

function initGrupo(f: FilaProyeccion): GrupoProyeccion {
  const profitMxn = f.venta_mxn - f.costo_mxn;
  const profitUsd = f.venta_usd - f.costo_usd;
  return {
    expediente: f.expediente || "—",
    cliente_nombre: f.cliente_nombre,
    operador: f.operador,
    eta: f.eta,
    contenedores: f.contenedor ? [f.contenedor] : [],
    totalContenedores: f.contenedor ? 1 : 0,
    ventaMxn: f.venta_mxn,
    ventaUsd: f.venta_usd,
    costoMxn: f.costo_mxn,
    costoUsd: f.costo_usd,
    profitMxn,
    profitUsd,
    margenPct: f.venta_mxn > 0 ? (profitMxn / f.venta_mxn) * 100 : 0,
    estado: f.tiene_proforma && f.tiene_factura_pdf ? "Facturado" : "Pendiente",
    embarqueIds: [f.embarque_id],
    sinTc: f.sin_tc,
  };
}

function mergeFila(prev: GrupoProyeccion, f: FilaProyeccion): void {
  if (f.contenedor && !prev.contenedores.includes(f.contenedor)) {
    prev.contenedores.push(f.contenedor);
  }
  prev.totalContenedores = prev.contenedores.length || prev.totalContenedores + 1;
  prev.ventaMxn += f.venta_mxn;
  prev.ventaUsd += f.venta_usd;
  prev.costoMxn += f.costo_mxn;
  prev.costoUsd += f.costo_usd;
  prev.profitMxn = prev.ventaMxn - prev.costoMxn;
  prev.profitUsd = prev.ventaUsd - prev.costoUsd;
  prev.margenPct = prev.ventaMxn > 0 ? (prev.profitMxn / prev.ventaMxn) * 100 : 0;
  prev.embarqueIds.push(f.embarque_id);
  if (f.eta && (!prev.eta || f.eta < prev.eta)) prev.eta = f.eta;
  if (!(f.tiene_proforma && f.tiene_factura_pdf)) prev.estado = "Pendiente";
  // Ola 5 · M5: basta un embarque sin TC para marcar el expediente completo.
  if (f.sin_tc) prev.sinTc = true;
}

/** Agrupa filas planas por expediente y consolida totales/estado. */
export function agruparPorExpediente(filas: FilaProyeccion[]): GrupoProyeccion[] {
  const map = new Map<string, GrupoProyeccion>();
  for (const f of filas) {
    const key = f.expediente || `_sin_exp_${f.embarque_id}`;
    const prev = map.get(key);
    if (!prev) map.set(key, initGrupo(f));
    else mergeFila(prev, f);
  }
  return Array.from(map.values()).sort((a, b) => {
    const ea = a.eta ?? "9999-12-31";
    const eb = b.eta ?? "9999-12-31";
    if (ea !== eb) return ea.localeCompare(eb);
    return a.expediente.localeCompare(b.expediente);
  });
}
