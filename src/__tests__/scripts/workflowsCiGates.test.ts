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

  it("conserva el budget original del entry (365 KB) y el comentario coincide", () => {
    const script = leer("scripts/check-bundle-size.sh");
    expect(script).toContain('BUDGET_KB="${BUNDLE_BUDGET_KB:-365}"');
    expect(ci).toContain("entry 365 KB gz");
  });
});

describe("e2e.yml · guard-secrets no puede dar falso verde", () => {
  it("el gate anti-skip valida el resultado de guard-secrets", () => {
    expect(e2e).toContain("R_GUARD: ${{ needs.guard-secrets.result }}");
    expect(e2e).toMatch(/guard-secrets no terminó en success/);
  });

  it("el merge sin blobs exige guard-secrets=success", () => {
    expect(e2e).toMatch(/Sin blob reports y guard-secrets=\$R_GUARD/);
  });

  it("la excepción de omisión sólo cubre multi-tenant", () => {
    expect(e2e).toMatch(/\[ "\$R_MT" = "skipped" \] && \[ "\$MT_OK" = "true" \]/);
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

  it("mantiene el ensayo de cinco shards sin cobertura ni blobs", () => {
    expect(ci).toContain("max-parallel: 5");
    expect(ci).toContain("shard: [1, 2, 3, 4, 5]");
    expect(ci).toContain("Vitest shard ${{ matrix.shard }}/5");
    expect(ci).toContain("--shard=${{ matrix.shard }}/5");
    expect(ci).toContain("Sin coverage, sin blobs/merge/artifacts");
  });
});
