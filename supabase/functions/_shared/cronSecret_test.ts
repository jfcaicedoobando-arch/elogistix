/**
 * R3 · P3 — Guarda estructural: ningún cron compara CRON_SECRET con === / !==
 * (timing); todos pasan por timingSafeEqual (_shared/timingSafe.ts), el patrón
 * que ya usaban verificar-sat-semanal y reconciliar-cancelaciones.
 *
 * Run: deno test --no-check --allow-read supabase/functions/_shared/cronSecret_test.ts
 */
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

async function leer(archivo: string): Promise<string> {
  return await Deno.readTextFile(new URL(archivo, import.meta.url));
}

const CRONS = [
  "../tc-dof-diario/index.ts",
  "../auditoria-weekly-digest/index.ts",
  "../rep-retry-nocturno/index.ts",
  "../auditoria-snapshot-daily/index.ts",
  "../verificar-sat-semanal/index.ts",
];

for (const archivo of CRONS) {
  Deno.test(`P3 cron secret: ${archivo} compara con timingSafeEqual`, async () => {
    const src = await leer(archivo);
    assertStringIncludes(src, "timingSafeEqual");
    assert(
      !src.includes("!== cronSecret") && !src.includes("!== CRON_SECRET") &&
        !src.includes("headerValue === secret") && !src.includes("=== cronSecret"),
      `${archivo} conserva comparación no constante en tiempo`,
    );
  });
}
