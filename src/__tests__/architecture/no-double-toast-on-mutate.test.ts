/**
 * Guardrail de arquitectura (13.85.10): los componentes/controladores NO
 * deben pasar callbacks `onSuccess`/`onError`/`onSettled` que disparen toasts
 * cuando llaman `mutation.mutate(vars, { ... })` o `mutation.mutateAsync(...)`.
 *
 * **Convención del proyecto:** el toast vive en el hook de mutación
 * (`useMutation({ onSuccess: notifySuccess, onError: notifyError })`). Los
 * call sites pueden seguir usando `onSuccess` para reacciones locales (cerrar
 * dialog, limpiar form, redirigir) pero **nunca** para notificar — eso causa
 * doble toast porque TanStack Query acumula los callbacks de ambas capas.
 *
 * El scanner es regex deliberadamente simple: busca cada `.mutate(` /
 * `.mutateAsync(` con un objeto de opciones como segundo argumento, extrae
 * los bloques `onSuccess`/`onError`/`onSettled` por balance de llaves, y
 * prohíbe que su cuerpo contenga `toast`, `notifySuccess`, `notifyError`,
 * `notifyWarning` o `notifyInfo`. Falsos positivos legítimos van a
 * `WHITELIST` con justificación.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

/** Casos excepcionales (justificación obligatoria). */
const WHITELIST = new Set<string>([
  // `useResponderCotizacion` deja explícitamente el toast en el controller
  // (ver comentario en `mutations/usePortalCotizacionMutations.ts`). El hook
  // sólo invalida cache; el toast con fecha formateada y mensaje según
  // Aceptada/Rechazada vive en el controller, que es la única notificación.
  "src/features/cotizacion/hooks/usePortalCotizacionDetalleController.ts",
  // `DialogTimbrarFactura` encadena `enviarCfdiFactura` dentro del onSuccess
  // de `useTimbrarFactura` cuando el usuario marca "enviar email". El toast
  // de envío vive aquí porque la acción es opcional (checkbox) y no forma
  // parte del hook de timbrado.
  "src/features/facturacion/components/DialogTimbrarFactura.tsx",
  // `useTimbrarFacturaDialog` extrae la lógica de `DialogTimbrarFactura`
  // (Power of 10 <200 líneas). Mantiene la misma justificación: el toast
  // del envío opcional del CFDI por email vive aquí, no en `useTimbrarFactura`.
  "src/features/facturacion/hooks/useTimbrarFacturaDialog.ts",
]);

const TOAST_TOKENS = /\b(toast\s*[.(]|notifySuccess|notifyError|notifyWarning|notifyInfo)\b/;
const CB_NAMES = ["onSuccess", "onError", "onSettled", "onMutate"] as const;

/** Devuelve el contenido del objeto `{...}` que abre en `start` (índice del `{`). */
function extractBraceBlock(src: string, openBraceIdx: number): { body: string; end: number } | null {
  if (src[openBraceIdx] !== "{") return null;
  let depth = 1;
  let i = openBraceIdx + 1;
  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    i++;
  }
  if (depth !== 0) return null;
  return { body: src.slice(openBraceIdx + 1, i - 1), end: i };
}

/** Busca el primer `{` no-string a partir de `from` saltando espacios. */
function nextBraceSkippingWs(src: string, from: number): number {
  let i = from;
  while (i < src.length && /\s/.test(src[i])) i++;
  return src[i] === "{" ? i : -1;
}

interface Violation { line: number; cb: string; snippet: string }

function scanFile(filePath: string): Violation[] {
  const src = readFileSync(filePath, "utf-8");
  const violations: Violation[] = [];
  // Buscar `.mutate(` o `.mutateAsync(` con SEGUNDO argumento `{...}`.
  const reCall = /\.\s*(mutate|mutateAsync)\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = reCall.exec(src)) !== null) {
    const argsStart = m.index + m[0].length;
    // Saltar primer argumento. Buscar la coma top-level dentro del paréntesis.
    let depth = 1;
    let i = argsStart;
    let firstCommaIdx = -1;
    let inStr: string | null = null;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      const prev = src[i - 1];
      if (inStr) {
        if (ch === inStr && prev !== "\\") inStr = null;
      } else if (ch === '"' || ch === "'" || ch === "`") {
        inStr = ch;
      } else if (ch === "(" || ch === "{" || ch === "[") {
        depth++;
      } else if (ch === ")" || ch === "}" || ch === "]") {
        depth--;
      } else if (ch === "," && depth === 1 && firstCommaIdx === -1) {
        firstCommaIdx = i;
      }
      i++;
    }
    if (firstCommaIdx === -1) continue;
    const braceIdx = nextBraceSkippingWs(src, firstCommaIdx + 1);
    if (braceIdx === -1) continue;
    const block = extractBraceBlock(src, braceIdx);
    if (!block) continue;

    // Para cada callback de interés, extraer su cuerpo y revisar tokens de toast.
    for (const cb of CB_NAMES) {
      const reCb = new RegExp(`\\b${cb}\\s*:`, "g");
      let cbMatch: RegExpExecArray | null;
      while ((cbMatch = reCb.exec(block.body)) !== null) {
        const after = cbMatch.index + cbMatch[0].length;
        // Buscar el `=>` o función y luego el cuerpo (puede ser `{...}` o expr).
        // Estrategia: tomar la sub-cadena hasta el siguiente top-level `,` o fin.
        let j = after;
        let d = 0;
        let s: string | null = null;
        while (j < block.body.length) {
          const ch = block.body[j];
          const prev = block.body[j - 1];
          if (s) {
            if (ch === s && prev !== "\\") s = null;
          } else if (ch === '"' || ch === "'" || ch === "`") {
            s = ch;
          } else if (ch === "(" || ch === "{" || ch === "[") {
            d++;
          } else if (ch === ")" || ch === "}" || ch === "]") {
            if (d === 0) break;
            d--;
          } else if (ch === "," && d === 0) {
            break;
          }
          j++;
        }
        const cbBody = block.body.slice(after, j);
        if (TOAST_TOKENS.test(cbBody)) {
          const absIdx = braceIdx + 1 + cbMatch.index;
          const line = src.slice(0, absIdx).split("\n").length;
          violations.push({
            line,
            cb,
            snippet: cbBody.replace(/\s+/g, " ").trim().slice(0, 120),
          });
        }
      }
    }
  }
  return violations;
}

describe("Toast convention: components must not duplicate hook toasts on .mutate()", () => {
  it("ningún .mutate/.mutateAsync en src/features dispara toasts en sus callbacks", async () => {
    const files = await fg(
      [
        "src/features/**/*.ts",
        "src/features/**/*.tsx",
        "src/hooks/**/*.ts",
        "src/hooks/**/*.tsx",
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

    const violations: Array<{ file: string; hits: Violation[] }> = [];
    for (const rel of files) {
      if (WHITELIST.has(rel)) continue;
      const full = path.join(ROOT, rel);
      const hits = scanFile(full);
      if (hits.length > 0) violations.push({ file: rel, hits });
    }

    if (violations.length > 0) {
      const report = violations
        .map((v) =>
          `  - ${v.file}\n` +
          v.hits.map((h) => `      L${h.line} ${h.cb}: ${h.snippet}`).join("\n"),
        )
        .join("\n");
      throw new Error(
        `Se encontraron ${violations.length} archivo(s) con toasts duplicados en callbacks de .mutate/.mutateAsync:\n${report}\n\n` +
          `Convención: el toast vive en el hook de mutación (useMutation onSuccess/onError).\n` +
          `Mueve la notificación al hook o, si es legítima, registra el archivo en WHITELIST con justificación.`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
