/**
 * Guardrail de arquitectura (13.68.0): toda `useMutation({...})` en hooks de
 * features y `src/hooks` debe declarar un callback `onError` para no tragarse
 * errores silenciosamente al usuario.
 *
 * Es un scanner regex deliberadamente simple: busca la llamada `useMutation(`
 * y verifica que `onError` aparezca antes del siguiente `});` que cierra el
 * objeto de opciones. Si tu mutación es legítimamente silenciosa (caso muy
 * raro), agrega la ruta a `WHITELIST` con justificación.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

/**
 * Casos excepcionales (justificación obligatoria).
 * Mantener vacío salvo razón sólida documentada.
 */
const WHITELIST = new Set<string>([
  // `useEliminarEmbarque` es silencioso por diseño: la UI consumidora
  // (`DialogEliminarEmbarque`) muestra el toast con el mensaje enriquecido
  // (expediente + error real). Un onError aquí produciría doble toast.
  "src/features/embarques/hooks/mutations/useDeleteEmbarque.ts",
  // `useRegistrarPagoProveedor` es silencioso por diseño: la UI consumidora
  // (`DialogRegistrarPagoProveedor`) emite los toasts de éxito/error con
  // mensajes traducidos. Un onError aquí produciría doble toast (v13.218.2).
  "src/features/cxp/hooks/usePagosProveedor.ts",
  // `useUpsertCotizacionCostos` es silencioso por diseño (v13.823.164): sus dos
  // únicos consumidores notifican el fallo en su propio `catch`
  // —`SeccionCostosInternosPLDetalle` ("Error al guardar") y
  // `usePaso2Handler` (conflicto / "Error al guardar costos", que cubre
  // Nueva y Editar cotización)—. Un onError aquí produciría doble toast.
  "src/features/cotizacion/hooks/useCotizacionCostos.ts",

]);

function findUseMutationsWithoutOnError(filePath: string): number[] {
  const src = readFileSync(filePath, "utf-8");
  const missing: number[] = [];
  const regex = /\buseMutation\s*</.source + "?\\s*\\(\\s*\\{";
  const re = new RegExp(regex, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    const start = m.index + m[0].length;
    // Encontrar el cierre `}` correspondiente
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    const block = src.slice(start, i - 1);
    if (!/\bonError\s*:/.test(block)) {
      // Calcular línea aproximada
      const line = src.slice(0, m.index).split("\n").length;
      missing.push(line);
    }
  }
  return missing;
}

describe("Toast coverage: useMutation requiere onError", () => {
  it("todas las mutations en src/features y src/hooks tienen onError", async () => {
    const files = await fg(
      [
        "src/features/**/hooks/**/use*.ts",
        "src/features/**/hooks/**/use*.tsx",
        "src/hooks/**/use*.ts",
        "src/hooks/**/use*.tsx",
      ],
      {
        cwd: ROOT,
        ignore: [
          "**/__tests__/**",
          "**/*.test.ts",
          "**/*.test.tsx",
          "**/*.spec.ts",
          "**/*.spec.tsx",
        ],
      },
    );

    const violations: Array<{ file: string; lines: number[] }> = [];
    for (const rel of files) {
      if (WHITELIST.has(rel)) continue;
      const full = path.join(ROOT, rel);
      const src = readFileSync(full, "utf-8");
      if (!/\buseMutation\s*[<(]/.test(src)) continue;
      const missing = findUseMutationsWithoutOnError(full);
      if (missing.length > 0) violations.push({ file: rel, lines: missing });
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) => `  - ${v.file} (líneas: ${v.lines.join(", ")})`)
        .join("\n");
      throw new Error(
        `Se encontraron ${violations.length} archivos con useMutation sin onError:\n${report}\n\n` +
          `Agrega onError con notifyError(...) o registra el archivo en WHITELIST con justificación.`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
