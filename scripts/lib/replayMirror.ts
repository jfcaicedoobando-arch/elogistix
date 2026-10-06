import { createHash } from "node:crypto";
import { extraerFunciones, type DefinicionFuncion } from "./replayMirrorFunctions";

export interface EntradaBaseline {
  espejo: string;
  funcion: string;
  firma: string;
  migracion_vigente: string;
  sha256_espejo: string;
  sha256_migracion: string;
  responsable: string;
  justificacion: string;
  condicion_retiro: string;
}

const CAMPOS = ["espejo", "funcion", "firma", "migracion_vigente", "sha256_espejo",
  "sha256_migracion", "responsable", "justificacion", "condicion_retiro"] as const;

export function leerBaseline(value: unknown): EntradaBaseline[] {
  if (!value || typeof value !== "object" || !("entradas" in value) || !Array.isArray(value.entradas)) {
    throw new Error("Baseline inválido: falta entradas[]");
  }
  const seen = new Set<string>();
  return value.entradas.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || !CAMPOS.every((key) => key in entry
      && typeof Reflect.get(entry, key) === "string" && Reflect.get(entry, key).trim() !== "")) {
      throw new Error(`Baseline inválido: se requieren ${CAMPOS.join(", ")}`);
    }
    const parsed = entry as EntradaBaseline;
    if (![parsed.sha256_espejo, parsed.sha256_migracion].every((hash) => /^[a-f0-9]{64}$/.test(hash))) {
      throw new Error(`Baseline inválido: huella SHA-256 requerida en ${parsed.firma}`);
    }
    if (!parsed.firma.startsWith(`${parsed.funcion}(`)) throw new Error(`Baseline inválido: firma ${parsed.firma}`);
    const key = `${parsed.espejo}::${parsed.firma}`;
    if (seen.has(key)) throw new Error(`Baseline duplicado: ${key}`);
    seen.add(key);
    return parsed;
  });
}

export function huellaDefinicion(definicion: DefinicionFuncion): string {
  return createHash("sha256").update(definicion.cuerpo).digest("hex");
}

export function indexarMigraciones(migraciones: ReadonlyMap<string, string>) {
  const indice = new Map<string, { migracion: string; definicion: DefinicionFuncion }>();
  for (const [migracion, sql] of [...migraciones].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    for (const definicion of extraerFunciones(sql)) indice.set(definicion.firma, { migracion, definicion });
  }
  return indice;
}

function validarExcepcion(entrada: EntradaBaseline, espejo: DefinicionFuncion,
  vigente: { migracion: string; definicion: DefinicionFuncion }): string[] {
  const cambios: string[] = [];
  if (entrada.migracion_vigente !== vigente.migracion) cambios.push(`migración vigente: ${vigente.migracion}`);
  if (entrada.sha256_espejo !== huellaDefinicion(espejo)) cambios.push("huella del espejo");
  if (entrada.sha256_migracion !== huellaDefinicion(vigente.definicion)) cambios.push("huella de la migración");
  return cambios;
}

export function auditarReplayMirror(espejos: ReadonlyMap<string, string>,
  migraciones: ReadonlyMap<string, string>, baseline: EntradaBaseline[]) {
  const indice = indexarMigraciones(migraciones);
  const entradas = new Map(baseline.map((entry) => [`${entry.espejo}::${entry.firma}`, entry]));
  const usadas = new Set<string>();
  const violaciones: string[] = [];
  let verificados = 0;
  let tolerados = 0;
  for (const [file, sql] of espejos) {
    const definitions = extraerFunciones(sql);
    if (!definitions.length) violaciones.push(`${file}: no se pudo extraer ningún CREATE OR REPLACE FUNCTION`);
    const firmas = new Set<string>();
    for (const definition of definitions) {
      const key = `${file}::${definition.firma}`;
      if (firmas.has(definition.firma)) { violaciones.push(`${key}: firma duplicada en el espejo`); continue; }
      firmas.add(definition.firma);
      const vigente = indice.get(definition.firma);
      const entrada = entradas.get(key);
      if (entrada) usadas.add(key);
      if (!vigente) { violaciones.push(`${key}: no tiene migración que defina la firma completa (espejo huérfano)`); continue; }
      if (definition.cuerpo === vigente.definicion.cuerpo) {
        if (entrada) violaciones.push(`${key}: ya NO diverge; retira la entrada muerta del baseline`);
        else verificados++;
        continue;
      }
      if (entrada) {
        const cambios = validarExcepcion(entrada, definition, vigente);
        if (cambios.length) violaciones.push(`${key}: excepción modificada (${cambios.join("; ")}); requiere revisión, no ampliar baseline`);
        else tolerados++;
        continue;
      }
      violaciones.push(`${key}: diverge de ${vigente.migracion} (espejo ${huellaDefinicion(definition)}, migración ${huellaDefinicion(vigente.definicion)})`);
    }
  }
  for (const key of entradas.keys()) {
    if (!usadas.has(key)) violaciones.push(`${key}: entrada del baseline que ya no existe; retírala`);
  }
  return { violaciones, verificados, tolerados };
}
