/**
 * M1 (auditoría de arquitectura 2026-07-29) — Freshness-check de marcadores
 * `// SAFE-CAST:`.
 *
 * El audit de casts (`scripts/lib/casts.ts`) degrada HIGH → LOW cualquier cast
 * precedido por un comentario `// SAFE-CAST:`. Ese marcador nunca caducaba: si
 * la justificación decía "los tipos generados aún no lo listan" y más tarde
 * `src/integrations/supabase/types.ts` sí lo declaraba, el cast quedaba
 * silenciado para siempre.
 *
 * Este test falla cuando una justificación de tipo "aún no está en los tipos
 * generados" menciona un identificador (RPC, columna o parámetro) que YA existe
 * en `types.ts`. En ese caso el cast debe eliminarse, no seguir degradado.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "src");
const TYPES_PATH = join(SRC, "integrations/supabase/types.ts");

/** Frases que afirman "todavía no está tipado" (ES, variantes reales del repo). */
const STALE_CLAIM =
  /(a[úu]n no|todav[íi]a no|no est[áa]n?\s+(en\s+)?(los\s+)?tipos|no (lo )?(listan?|recoge|refleja|incluye))/i;

/** Ventana de búsqueda del identificador alrededor del comentario. */
const LINES_BEFORE = 3;
const LINES_AFTER = 5;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "integrations") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Extrae identificadores candidatos: strings, backticks e identificadores snake_case. */
function candidateIdentifiers(window: string): string[] {
  const found = new Set<string>();
  const patterns = [/`([a-z0-9_]{4,})`/gi, /["']([a-z0-9_]{4,})["']/gi, /\b(_?[a-z]+(?:_[a-z0-9]+){1,})\b/gi];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(window)) !== null) {
      const id = m[1];
      if (id && id.includes("_")) found.add(id);
    }
  }
  return [...found];
}

/**
 * Baseline (ratchet) de marcadores heredados que ya estaban en el repo cuando
 * se introdujo este check. Solo puede ENCOGER: si un marcador se limpia, hay
 * que borrar su entrada aquí (el test avisa si una entrada quedó obsoleta).
 * Clave: `<ruta relativa>::<identificador>`.
 */
const BASELINE = new Set<string>([
  "src/features/cotizacion/services/mutations/reactivar.ts::estado_anterior",
  "src/features/cotizacion/services/versiones.ts::duplicar_cotizacion",
  "src/features/cotizacion/services/versiones.ts::cotizacion_versiones",
  "src/features/embarques/components/_sections/tabDemorasColumns.tsx::fecha_descarga",
  "src/features/embarques/services/alertas.ts::embarques_alertas_ids",
  "src/features/embarques/services/contenedores/demoras.ts::embarque_contenedores",
  "src/features/embarques/services/garantias.ts::set_garantia_estado",
  "src/features/embarques/services/garantias.ts::refrescar_garantia_desde_tarifa",
  "src/features/embarques/services/mutations.ts::actualizar_embarque_completo",
  "src/features/embarques/services/mutations.ts::reabrir_embarque",
  "src/features/embarques/services/reconciliacion3Columnas.ts::cotizacion_id",
  "src/features/proformas/components/AccionesProforma.tsx::estado_cliente",
  "src/features/proformas/domain/proformaClienteEstado.ts::estado_cliente",
  "src/features/proformas/services/portalPublico.ts::portal_responder_por_token",
  "src/features/proformas/services/respuestaCliente.ts::actualizar_estado_cliente_proforma",
]);

function detectarObsoletos(): { key: string; detalle: string }[] {
  const types = readFileSync(TYPES_PATH, "utf8");
  const out: { key: string; detalle: string }[] = [];

  for (const file of walk(SRC)) {
    const rel = relative(process.cwd(), file).replace(/\\/g, "/");
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, idx) => {
      if (!/\/\/\s*SAFE-CAST:/.test(line)) return;
      if (!STALE_CLAIM.test(line)) return;

      const window = lines
        .slice(Math.max(0, idx - LINES_BEFORE), idx + LINES_AFTER + 1)
        .join("\n");

      for (const id of candidateIdentifiers(window)) {
        // Identificador declarado en types.ts (clave de objeto o nombre de tipo).
        const declared = new RegExp(`(^|[\\s"'\`{,(])${id}\\??\\s*[:?]`, "m").test(types);
        if (declared) {
          out.push({
            key: `${rel}::${id}`,
            detalle: `${rel}:${idx + 1} — alega falta de tipos pero \`${id}\` ya existe en types.ts`,
          });
          break;
        }
      }
    });
  }
  return out;
}

describe("architecture: marcadores SAFE-CAST no caducados", () => {
  const obsoletos = detectarObsoletos();

  it("no aparecen SAFE-CAST obsoletos nuevos (fuera de la baseline)", () => {
    const nuevos = obsoletos.filter((o) => !BASELINE.has(o.key)).map((o) => o.detalle);
    expect(
      nuevos,
      `SAFE-CAST obsoletos nuevos (el tipo ya existe; elimina el cast en vez de silenciarlo):\n${nuevos.join("\n")}`,
    ).toEqual([]);
  });

  it("la baseline no contiene entradas ya resueltas (solo puede encoger)", () => {
    const vigentes = new Set(obsoletos.map((o) => o.key));
    const resueltas = [...BASELINE].filter((k) => !vigentes.has(k));
    expect(
      resueltas,
      `Entradas de BASELINE ya resueltas: bórralas de safe-cast-freshness.test.ts:\n${resueltas.join("\n")}`,
    ).toEqual([]);
  });
});

