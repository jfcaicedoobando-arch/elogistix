/**
 * Guards de los workflows de GitHub Actions (P1 auditoría de CI).
 *
 * Analogía: son las alarmas del tablero. No manejan el coche, sólo avisan si
 * alguien desconecta un sensor (el gate de tamaño del bundle, la opcionalidad
 * de multi-tenant o el fallo del merge de reportes).
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const raiz = process.cwd();
const leer = (rel: string): string => fs.readFileSync(path.join(raiz, rel), "utf8");

const ci = leer(".github/workflows/ci.yml");
const e2e = leer(".github/workflows/e2e.yml");

describe("ci.yml · bundle size gate", () => {
  it("ejecuta scripts/check-bundle-size.sh", () => {
    expect(ci).toContain("bash scripts/check-bundle-size.sh");
  });

  it("lo ejecuta después del build", () => {
    expect(ci.indexOf("bash scripts/check-bundle-size.sh")).toBeGreaterThan(
      ci.indexOf("run: bun run build"),
    );
  });

  it("el script existe y es ejecutable por bash", () => {
    expect(fs.existsSync(path.join(raiz, "scripts/check-bundle-size.sh"))).toBe(true);
  });
});

describe("e2e.yml · multi-tenant opcional", () => {
  it("el guard expone mt_ok sin fallar cuando faltan E2E_MT_*", () => {
    expect(e2e).toContain('echo "mt_ok=false" >> "$GITHUB_OUTPUT"');
    expect(e2e).toContain('echo "mt_ok=true" >> "$GITHUB_OUTPUT"');
  });

  it("el job multi-tenant está condicionado a mt_ok", () => {
    expect(e2e).toContain("needs.guard-secrets.outputs.mt_ok == 'true'");
  });

  it("los secrets CORE siguen siendo obligatorios", () => {
    expect(e2e).toMatch(/E2E secrets CORE ausentes[\s\S]{0,200}exit 1/);
  });
});

describe("e2e.yml · merge-reports", () => {
  it("no oculta el fallo del merge con || echo", () => {
    expect(e2e).not.toContain('merge-reports --reporter=html ./all-blob-reports || echo');
  });

  it("ejecuta el merge sin enmascarar el código de salida", () => {
    expect(e2e).toContain("bunx playwright merge-reports --reporter=html ./all-blob-reports\n");
  });

  it("falla si no hay blobs y algún job de tests sí corrió", () => {
    expect(e2e).toContain("No hay blob reports pero algún job de tests corrió");
  });
});

describe("docs de shards", () => {
  it("existe el procedimiento de medición y el script", () => {
    expect(fs.existsSync(path.join(raiz, "docs/ci-vitest-shards.md"))).toBe(true);
    expect(fs.existsSync(path.join(raiz, "scripts/bench-vitest-shards.sh"))).toBe(true);
    expect(ci).toContain("docs/ci-vitest-shards.md");
  });
});
