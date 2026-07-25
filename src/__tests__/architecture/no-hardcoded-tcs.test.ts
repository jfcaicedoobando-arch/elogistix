import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import fg from "fast-glob";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../../..");

/**
 * Detecta multiplicaciones/divisiones literales por 20 aplicadas a un TC —
 * ignora clases Tailwind (`bg-muted/20`, `border-primary/20`, `py-20`, etc.)
 * y literales dentro de strings/comentarios.
 *
 * Un TC hardcodeado se ve así en código productivo:
 *   total * 20
 *   monto / 20
 *   20 * total
 *
 * Este test es SEMÁNTICO: recorre el archivo línea por línea saltándose
 * comentarios de línea y líneas que están claramente dentro de un className.
 */
function findHardcodedTcMultiplier(src: string): number | null {
  const lines = src.split("\n");
  // Coincide con `<ident/paren> * 20` o `20 * <ident/paren>` (mult/div binaria contra 20).
  const OP_RE = /(?:[)\]a-zA-Z_$][)\]a-zA-Z_$\d]*\s*[*/]\s*20\b|\b20\s*[*/]\s*[(a-zA-Z_$])/;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Descartar comentarios de línea.
    const slashIdx = line.indexOf("//");
    if (slashIdx >= 0) line = line.slice(0, slashIdx);
    // Descartar contenido dentro de strings (comillas simples/dobles/backticks sin ${}).
    line = line
      .replace(/`(?:[^`$]|\$(?!\{))*`/g, '``')
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");
    if (OP_RE.test(line)) return i + 1;
  }
  return null;
}

describe("Arquitectura: Sin TCs hardcodeados", () => {
  it("ningún archivo en cxp o compras contiene multiplicadores literales de TC (ej. * 20)", async () => {
    const files = await fg(
      ["src/features/cxp/**/*.{ts,tsx}", "src/features/compras/**/*.{ts,tsx}"],
      {
        cwd: ROOT,
        ignore: ["**/__tests__/**", "**/*.test.*", "**/*.spec.*"],
      },
    );

    const violators: string[] = [];
    for (const rel of files) {
      const src = readFileSync(path.join(ROOT, rel), "utf-8");
      const hit = findHardcodedTcMultiplier(src);
      if (hit != null) violators.push(`${rel}:${hit}`);
    }

    expect(
      violators,
      `Se encontraron posibles TCs hardcodeados (* 20 o / 20) en:\n  ${violators.join(
        "\n  ",
      )}\nUsa tipo_cambio_usd de la factura o el servicio Banxico.`,
    ).toEqual([]);
  });

  it("regex de detección: casos positivos y negativos", () => {
    // Positivos — deben detectarse.
    expect(findHardcodedTcMultiplier("const mxn = total * 20;")).not.toBeNull();
    expect(findHardcodedTcMultiplier("const mxn = 20 * total;")).not.toBeNull();
    expect(findHardcodedTcMultiplier("const usd = monto / 20;")).not.toBeNull();
    expect(findHardcodedTcMultiplier("return (total) * 20;")).not.toBeNull();

    // Negativos — no deben marcarse.
    expect(findHardcodedTcMultiplier(`<div className="border-primary/20" />`)).toBeNull();
    expect(findHardcodedTcMultiplier(`<div className="bg-muted/20 py-20" />`)).toBeNull();
    expect(findHardcodedTcMultiplier(`<tr className="odd:bg-background even:bg-muted/20">`)).toBeNull();
    expect(findHardcodedTcMultiplier("// mult * 20 en comentario")).toBeNull();
    expect(findHardcodedTcMultiplier(`const s = "x * 20";`)).toBeNull();
    expect(findHardcodedTcMultiplier("const n = 200;")).toBeNull();
    expect(findHardcodedTcMultiplier("const n = 2000;")).toBeNull();
  });
});
