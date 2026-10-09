/** Coincidencias tarifario ↔ solicitud de pricing (ruta, contenedor y vigencia). */
import type { TarifaTarifario } from "./tarifarioService";
import { claveCanonicaTipoContenedor } from "@/features/catalogos";

export interface SolicitudBusqueda {
  pol: string | null;
  pod: string | null;
  origen: string | null;
  destino: string | null;
  tipo_carga?: string | null;
  container_size?: string | null;
  fecha_tentativa_carga: string | null;
}

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

function coincidePuerto(pedido: string, puerto: string | undefined): boolean {
  const a = norm(pedido); const b = norm(puerto);
  if (!a) return true;
  return !!b && (b.includes(a) || a.includes(b));
}

function partesContenedor(campo: string) {
  const separado = norm(campo).replace(/[^a-z0-9]+/g, " ")
    .replace(/(\d+)([a-z]+)/g, "$1 $2").replace(/([a-z]+)(\d+)/g, "$1 $2");
  const tamano = separado.match(/\b(20|40|45|53)\b/)?.[1];
  // El tamaño auxiliar sólo permite obtener la categoría de un campo parcial
  // con las reglas compartidas; el tamaño real se extrae del propio campo.
  const claveCategoria = claveCanonicaTipoContenedor({ name: campo, code: "20" });
  const categoria = claveCategoria.startsWith("raw:") ? undefined : claveCategoria.split("|")[1];
  return { tamano, categoria };
}

function coincideContenedor(s: SolicitudBusqueda, tipo: TarifaTarifario["tipo"]): boolean {
  // El formulario persiste el nombre del catálogo en tipo_carga. Sólo las
  // solicitudes legacy sin ese campo recurren a container_size.
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

export function tarifasCoincidentes(s: SolicitudBusqueda, tarifas: readonly TarifaTarifario[], hoy: string): TarifaTarifario[] {
  const fecha = s.fecha_tentativa_carga && s.fecha_tentativa_carga > hoy ? s.fecha_tentativa_carga : hoy;
  const origen = s.pol || s.origen || "";
  const destino = s.pod || s.destino || "";
  return tarifas.filter((t) =>
    coincidePuerto(origen, t.ruta?.origen?.name) &&
    coincidePuerto(destino, t.ruta?.destino?.name) &&
    coincideContenedor(s, t.tipo) &&
    (!t.vigente_hasta || t.vigente_hasta >= fecha) &&
    (!t.vigente_desde || t.vigente_desde <= fecha),
  ).sort((a, b) => a.flete_base - b.flete_base).slice(0, 10);
}
