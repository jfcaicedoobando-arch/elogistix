/** Totales del apartado Comisiones del broker (en MXN, a centavos). */
export interface ComisionBroker { comision_mxn: number; estado: string; pagada: boolean }

const c = (n: number) => Math.round(n * 100);

export function totalesComisiones(filas: readonly ComisionBroker[]) {
  let pendiente = 0, liquidado = 0, pagado = 0;
  for (const f of filas) {
    const m = c(Number(f.comision_mxn) || 0);
    if (f.estado === "Devengada") pendiente += m;
    else if (f.estado === "Liquidada" && f.pagada) pagado += m;
    else if (f.estado === "Liquidada") liquidado += m;
  }
  return { pendiente: pendiente / 100, liquidado: liquidado / 100, pagado: pagado / 100 };
}

/** Estatus visible: Devengada → Liquidada → Pagada. */
export function estatusVisible(f: ComisionBroker): string {
  if (f.estado === "Liquidada") return f.pagada ? "Pagada" : "Liquidada";
  return f.estado;
}
