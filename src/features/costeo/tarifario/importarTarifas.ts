/**
 * Importación masiva de tarifas (CSV/Excel) para el tarifario.
 * Usa las mismas columnas que «Descargar Excel», así el archivo descargado
 * sirve de plantilla. Cada renglón puede generar una tarifa de 20" y otra de 40".
 * Lógica pura: no toca la base; la pantalla decide qué guardar.
 */
import type { TarifaInput } from "@/features/costeo/services/tarifas";

export interface CatalogosImport {
  puertos: ReadonlyArray<{ id: string; name: string; code: string | null }>;
  agentes: ReadonlyArray<{ id: string; nombre: string }>;
  navieras: ReadonlyArray<{ id: string; name: string; code?: string | null }>;
  tipos: ReadonlyArray<{ id: string; code: string }>;
  rutas: ReadonlyArray<{ id: string; puerto_origen_id: string; puerto_destino_id: string }>;
}

/** Tarifa lista para guardar; `ruta_id` vacío = la ruta se crea al importar. */
export interface TarifaImport { fila: number; input: TarifaInput; origenId: string; destinoId: string }
export interface ResultadoImport { tarifas: TarifaImport[]; errores: string[] }

const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

/** Encabezado normalizado → campo. Acepta variantes comunes. */
function campo(header: string): string | null {
  const h = norm(header).replace(/["”]/g, "");
  if (h.startsWith("origen")) return "origen";
  if (h.startsWith("destino")) return "destino";
  if (h.startsWith("agente")) return "agente";
  if (h.startsWith("naviera")) return "naviera";
  if (h.includes("20")) return "t20";
  if (h.includes("40")) return "t40";
  if (h.startsWith("inicio")) return "desde";
  if (h.startsWith("termino") || h.startsWith("fin")) return "hasta";
  if (h.startsWith("dias")) return "dias";
  if (h.startsWith("observ")) return "obs";
  return null;
}

/** Acepta Date, AAAA-MM-DD o DD/MM/AAAA; devuelve AAAA-MM-DD o null. */
export function fechaIso(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  const s = String(v ?? "").trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const mx = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  return mx ? `${mx[3]}-${mx[2].padStart(2, "0")}-${mx[1].padStart(2, "0")}` : null;
}

function numero(v: unknown): number | null {
  const s = String(v ?? "").replace(/[$,\s]|USD/gi, "");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function tipoPara(tipos: CatalogosImport["tipos"], tam: "20" | "40"): string | null {
  const pref = tam === "20" ? ["20GP", "20DV"] : ["40HC", "40GP", "40DV"];
  const exacto = pref.map((c) => tipos.find((t) => t.code.toUpperCase() === c)).find(Boolean);
  return (exacto ?? tipos.find((t) => t.code.startsWith(tam)))?.id ?? null;
}

const buscarPuerto = (c: CatalogosImport, v: string) =>
  c.puertos.find((p) => norm(p.code) === norm(v)) ?? c.puertos.find((p) => norm(p.name) === norm(v));

function normalizarFila(raw: Record<string, unknown>): Record<string, unknown> {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) { const f = campo(k); if (f && r[f] === undefined) r[f] = v; }
  return r;
}

interface ReferenciasFila {
  o: CatalogosImport["puertos"][number] | undefined;
  d: CatalogosImport["puertos"][number] | undefined;
  ag: CatalogosImport["agentes"][number] | undefined;
  nav: CatalogosImport["navieras"][number] | undefined;
}

function validarReferencias(r: Record<string, unknown>, { o, d, ag, nav }: ReferenciasFila, fallas: string[]): void {
  if (!o) fallas.push(`origen «${String(r.origen ?? "")}» no existe en puertos`);
  if (!d) fallas.push(`destino «${String(r.destino ?? "")}» no existe en puertos`);
  if (o && d && o.id === d.id) fallas.push("origen y destino son el mismo puerto");
  if (!ag) fallas.push(`agente «${String(r.agente ?? "")}» no existe`);
  if (!nav) fallas.push(`naviera «${String(r.naviera ?? "")}» no existe`);
}

function validarVigencia(desde: string | null, hasta: string | null, dias: number | null, fallas: string[]): void {
  if (!desde || !hasta) fallas.push("fechas de vigencia inválidas (usa DD/MM/AAAA)");
  else if (hasta < desde) fallas.push("el término de vigencia es anterior al inicio");
  if (dias === null || Number.isNaN(dias) || dias < 0) fallas.push("días libres inválidos");
}

function validarMontos(m20: number | null, m40: number | null, fallas: string[]): void {
  if (Number.isNaN(m20) || Number.isNaN(m40) || (m20 ?? 0) < 0 || (m40 ?? 0) < 0) fallas.push("tarifa inválida");
  if (!(m20 && m20 > 0) && !(m40 && m40 > 0)) fallas.push('falta la tarifa 20" o 40"');
}

function agregarTarifas(
  ubicacion: Omit<TarifaImport, "input">,
  base: Omit<TarifaInput, "tipo_contenedor_id" | "flete_base">,
  opciones: ReadonlyArray<readonly [number | null, string | null, "20" | "40"]>,
  resultado: ResultadoImport,
): void {
  const { fila, origenId, destinoId } = ubicacion;
  for (const [monto, tipo, tam] of opciones) {
    if (!monto || monto <= 0) continue;
    if (!tipo) { resultado.errores.push(`Fila ${fila}: no hay tipo de contenedor de ${tam}" en el catálogo`); continue; }
    resultado.tarifas.push({ fila, origenId, destinoId, input: { ...base, tipo_contenedor_id: tipo, flete_base: monto } });
  }
}

/** Convierte los renglones crudos del archivo en tarifas válidas + errores. */
export function prepararImportacion(filas: ReadonlyArray<Record<string, unknown>>, c: CatalogosImport): ResultadoImport {
  const tarifas: TarifaImport[] = [];
  const errores: string[] = [];
  const t20 = tipoPara(c.tipos, "20");
  const t40 = tipoPara(c.tipos, "40");
  filas.forEach((raw, i) => {
    const fila = i + 2;
    const r = normalizarFila(raw);
    if (Object.values(r).every((v) => String(v ?? "").trim() === "")) return;
    const fallas: string[] = [];
    const o = buscarPuerto(c, String(r.origen ?? ""));
    const d = buscarPuerto(c, String(r.destino ?? ""));
    const ag = c.agentes.find((a) => norm(a.nombre) === norm(r.agente));
    const nav = c.navieras.find((n) => norm(n.name) === norm(r.naviera) || (n.code && norm(n.code) === norm(r.naviera)));
    const desde = fechaIso(r.desde);
    const hasta = fechaIso(r.hasta);
    const dias = numero(r.dias);
    const m20 = numero(r.t20);
    const m40 = numero(r.t40);
    validarReferencias(r, { o, d, ag, nav }, fallas);
    validarVigencia(desde, hasta, dias, fallas);
    validarMontos(m20, m40, fallas);
    if (fallas.length || !o || !d || !ag || !nav || !desde || !hasta) {
      errores.push(`Fila ${fila}: ${fallas.join("; ")}`);
      return;
    }
    const ruta = c.rutas.find((x) => x.puerto_origen_id === o.id && x.puerto_destino_id === d.id);
    const base = {
      agente_id: ag.id, naviera_id: nav.id, ruta_id: ruta?.id ?? "", dias_libres_demoras: Number(dias),
      vigente_desde: desde, vigente_hasta: hasta, notas: String(r.obs ?? "").trim() || null, recargos: [],
    };
    agregarTarifas({ fila, origenId: o.id, destinoId: d.id }, base, [[m20, t20, "20"], [m40, t40, "40"]], { tarifas, errores });
  });
  return { tarifas, errores };
}
