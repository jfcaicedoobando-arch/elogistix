/** Coincidencias tarifario ↔ solicitud de pricing (ruta, contenedor y vigencia). */
import type { TarifaTarifario } from "./tarifarioService";

export interface SolicitudBusqueda {
  pol: string | null;
  pod: string | null;
  origen: string | null;
  destino: string | null;
  container_size: string | null;
  fecha_tentativa_carga: string | null;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function coincidePuerto(pedido: string, puerto: string | undefined): boolean {
  const a = norm(pedido); const b = norm(puerto);
  if (!a) return true;
  return !!b && (b.includes(a) || a.includes(b));
}

function coincideContenedor(pedido: string | null, code: string | undefined): boolean {
  const p = norm(pedido).replace(/[^0-9a-z]/g, "");
  if (!p) return true;
  const c = norm(code);
  return c.startsWith(p.slice(0, 2)) && (p.length <= 2 || c.includes(p.slice(2)) || p.includes(c.slice(2)));
}

export function tarifasCoincidentes(s: SolicitudBusqueda, tarifas: readonly TarifaTarifario[], hoy: string): TarifaTarifario[] {
  const fecha = s.fecha_tentativa_carga && s.fecha_tentativa_carga > hoy ? s.fecha_tentativa_carga : hoy;
  const origen = s.pol || s.origen || "";
  const destino = s.pod || s.destino || "";
  return tarifas.filter((t) =>
    coincidePuerto(origen, t.ruta?.origen?.name) &&
    coincidePuerto(destino, t.ruta?.destino?.name) &&
    coincideContenedor(s.container_size, t.tipo?.code) &&
    (!t.vigente_hasta || t.vigente_hasta >= fecha) &&
    (!t.vigente_desde || t.vigente_desde <= fecha),
  ).sort((a, b) => a.flete_base - b.flete_base).slice(0, 10);
}
