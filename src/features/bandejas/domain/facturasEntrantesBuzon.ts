/**
 * Reglas puras de presentación del Buzón de facturas de proveedor (CxP Inbox).
 *
 * v13.365.0 — Semáforo de antigüedad, búsqueda, chips de filtro y orden.
 * v13.746.2 — Los tipos de fila viven en `facturasEntrantesTipos.ts` y el
 * cálculo de importe en `facturasEntrantesImporte.ts` (límite de 200 líneas).
 * La página sólo orquesta: todas las reglas viven aquí y están testeadas.
 */
import { chipsArchivosEntrante, diasEnEspera, faltaXmlFiscal } from "@/lib/domain/facturasEntrantes";
import { nombreDesdeEmail } from "@/lib/formatters/text";
import { importeEntrante } from "./facturasEntrantesImporte";
import type { FilaBuzon, TonoAntiguedad } from "./facturasEntrantesTipos";

export type { FilaBuzon, TonoAntiguedad } from "./facturasEntrantesTipos";
export { importeEntrante } from "./facturasEntrantesImporte";

/** Umbral (en días) a partir del cual el documento se considera atrasado. */
export const DIAS_ATRASO_BUZON = 3;


/** Etiqueta legible + tono semántico según los días en espera. */
export function etiquetaAntiguedad(dias: number): { label: string; tono: TonoAntiguedad } {
  if (dias <= 0) return { label: "Hoy", tono: "neutral" };
  if (dias === 1) return { label: "Ayer", tono: "info" };
  if (dias < DIAS_ATRASO_BUZON) return { label: `${dias} días`, tono: "info" };
  if (dias < 7) return { label: `${dias} días`, tono: "warning" };
  return { label: `${dias} días`, tono: "destructive" };
}

/** Antigüedad de una fila del buzón, ya resuelta a etiqueta y tono. */
export function antiguedadEntrante(row: { created_at: string }, ahora?: Date) {
  const dias = diasEnEspera(row.created_at, ahora);
  return { dias, ...etiquetaAntiguedad(dias) };
}

/** Un CFDI nacional sin XML no es deducible: se marca y se puede filtrar. */
export function entranteSinXml(row: FilaBuzon): boolean {
  return faltaXmlFiscal({
    esNacional: (row.proveedores?.origen_proveedor ?? "Nacional") === "Nacional",
    tieneXml: chipsArchivosEntrante(row).includes("xml"),
  });
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Busca en proveedor, expediente, operador, folio y nombre de archivo. */
export function coincideBusquedaEntrante(row: FilaBuzon, termino: string): boolean {
  const q = normalizar(termino.trim());
  if (!q) return true;
  const campos = [
    row.proveedores?.nombre ?? "",
    row.embarques?.expediente ?? "",
    // v13.619.0 — Se busca por correo crudo y por el nombre derivado.
    row.embarques?.operador ?? "",
    nombreDesdeEmail(row.embarques?.operador),
    row.folio_serie ?? "",
    row.nombre_archivo ?? "",
  ];
  return campos.some((campo) => normalizar(campo).includes(q));
}

/**
 * v13.398.0 — Un documento sin importe detectado obliga a abrir el archivo
 * para saber cuánto se debe: se marca y se puede filtrar.
 */
export function entranteSinImporte(row: FilaBuzon): boolean {
  return importeEntrante(row) === null;
}


export type ChipBuzon = "todos" | "sin_xml" | "sin_importe" | "atrasados" | "con_nota";

export const CHIPS_BUZON: readonly { id: ChipBuzon; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "sin_xml", label: "Sin XML" },
  { id: "sin_importe", label: "Sin importe" },
  { id: "atrasados", label: `${DIAS_ATRASO_BUZON}+ días` },
  { id: "con_nota", label: "Con nota" },
];

function cumpleChip(row: FilaBuzon, chip: ChipBuzon, ahora?: Date): boolean {
  if (chip === "sin_xml") return entranteSinXml(row);
  if (chip === "sin_importe") return entranteSinImporte(row);
  if (chip === "atrasados") return diasEnEspera(row.created_at, ahora) >= DIAS_ATRASO_BUZON;
  if (chip === "con_nota") return Boolean(row.nota && row.nota.trim());
  return true;
}


export type OrdenBuzon = "antiguos" | "recientes" | "proveedor";

export const ORDENES_BUZON: readonly { id: OrdenBuzon; label: string }[] = [
  { id: "antiguos", label: "Más antiguos primero" },
  { id: "recientes", label: "Más recientes primero" },
  { id: "proveedor", label: "Proveedor (A-Z)" },
];

export function ordenarEntrantes<T extends FilaBuzon>(filas: readonly T[], orden: OrdenBuzon): T[] {
  const copia = [...filas];
  if (orden === "proveedor") {
    return copia.sort((a, b) =>
      (a.proveedores?.nombre ?? "zzz").localeCompare(b.proveedores?.nombre ?? "zzz", "es-MX"),
    );
  }
  const factor = orden === "antiguos" ? 1 : -1;
  return copia.sort(
    (a, b) => factor * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
  );
}

export interface CriteriosBuzon {
  q?: string;
  chip?: ChipBuzon;
  orden?: OrdenBuzon;
  ahora?: Date;
}

/** Filtra + ordena en un solo paso (lo que consume la página). */
export function filtrarEntrantes<T extends FilaBuzon>(
  filas: readonly T[],
  criterios: CriteriosBuzon = {},
): T[] {
  const { q = "", chip = "todos", orden = "antiguos", ahora } = criterios;
  const filtradas = filas.filter(
    (row) => cumpleChip(row, chip, ahora) && coincideBusquedaEntrante(row, q),
  );
  return ordenarEntrantes(filtradas, orden);
}

export interface ResumenBuzon {
  total: number;
  atrasados: number;
  sinXml: number;
}

/** KPIs: siempre sobre el total, nunca sobre la lista filtrada. */
export function resumirBuzon(filas: readonly FilaBuzon[], ahora?: Date): ResumenBuzon {
  return {
    total: filas.length,
    atrasados: filas.filter((row) => diasEnEspera(row.created_at, ahora) >= DIAS_ATRASO_BUZON).length,
    sinXml: filas.filter(entranteSinXml).length,
  };
}
