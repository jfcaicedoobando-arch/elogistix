/**
 * Coincidencias tarifario ↔ solicitud de pricing.
 * Criterios: modo marítimo, tipo de contenedor, país de origen/destino y
 * vigencia. El puerto, si viene, sólo ordena (primero el mismo puerto); el
 * Incoterm decide los cargos que se suman en pantalla. Se devuelven todas.
 */
import type { TarifaTarifario } from "./tarifarioService";
import { claveCanonicaTipoContenedor } from "@/features/catalogos";

export interface SolicitudBusqueda {
  pol: string | null;
  pod: string | null;
  /** País de origen (solicitudes viejas pueden traer texto libre). */
  origen: string | null;
  /** País de destino (solicitudes viejas pueden traer texto libre). */
  destino: string | null;
  servicio?: string | null;
  tipo_carga?: string | null;
  container_size?: string | null;
  fecha_tentativa_carga: string | null;
}

type Puerto = { name: string; country?: string | null } | null | undefined;

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function coincidePuerto(pedido: string | null | undefined, puerto: string | undefined): boolean {
  const a = norm(pedido); const b = norm(puerto);
  return !!a && !!b && (b.includes(a) || a.includes(b));
}

/** País coincide por catálogo; texto viejo sin país se compara contra el puerto. */
function coincideExtremo(pais: string | null, puertoPedido: string | null, p: Puerto): boolean {
  if (norm(pais)) return norm(p?.country) === norm(pais) || coincidePuerto(pais, p?.name);
  if (norm(puertoPedido)) return coincidePuerto(puertoPedido, p?.name);
  return true;
}

function partesContenedor(campo: string) {
  const separado = norm(campo).replace(/[^a-z0-9]+/g, " ")
    .replace(/(\d+)([a-z]+)/g, "$1 $2").replace(/([a-z]+)(\d+)/g, "$1 $2");
  const tamano = separado.match(/\b(20|40|45|53)\b/)?.[1];
  const claveCategoria = claveCanonicaTipoContenedor({ name: campo, code: "20" });
  const categoria = claveCategoria.startsWith("raw:") ? undefined : claveCategoria.split("|")[1];
  return { tamano, categoria };
}

function coincideContenedor(s: SolicitudBusqueda, tipo: TarifaTarifario["tipo"]): boolean {
  const pedido = s.tipo_carga?.trim() || s.container_size?.trim();
  if (!pedido || !tipo) return false;
  const clave = claveCanonicaTipoContenedor({ name: pedido, code: "" });
  const codigo = partesContenedor(tipo.code);
  const nombre = partesContenedor(tipo.name ?? "");
  if (clave === "raw:" ||
    (codigo.tamano && nombre.tamano && codigo.tamano !== nombre.tamano) ||
    (codigo.categoria && nombre.categoria && codigo.categoria !== nombre.categoria)) return false;
  return clave === claveCanonicaTipoContenedor({ name: tipo.name ?? "", code: tipo.code });
}

/** El tarifario sólo tiene tarifas marítimas. */
function esMaritimo(servicio: string | null | undefined): boolean {
  const s = norm(servicio);
  return !s || s === "maritimo";
}

function puntajePuerto(s: SolicitudBusqueda, t: TarifaTarifario): number {
  return (coincidePuerto(s.pol, t.ruta?.origen?.name) ? 0 : 1) + (coincidePuerto(s.pod, t.ruta?.destino?.name) ? 0 : 1);
}

export function tarifasCoincidentes(s: SolicitudBusqueda, tarifas: readonly TarifaTarifario[], hoy: string): TarifaTarifario[] {
  if (!esMaritimo(s.servicio)) return [];
  const fecha = s.fecha_tentativa_carga && s.fecha_tentativa_carga > hoy ? s.fecha_tentativa_carga : hoy;
  return tarifas.filter((t) =>
    coincideExtremo(s.origen, s.pol, t.ruta?.origen) &&
    coincideExtremo(s.destino, s.pod, t.ruta?.destino) &&
    coincideContenedor(s, t.tipo) &&
    (!t.vigente_hasta || t.vigente_hasta >= fecha) &&
    (!t.vigente_desde || t.vigente_desde <= fecha),
  ).sort((a, b) => puntajePuerto(s, a) - puntajePuerto(s, b) || a.flete_base - b.flete_base);
}
