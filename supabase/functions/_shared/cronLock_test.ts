/**
 * R3 · P3 — Guarda estructural: los crons con trabajo no idempotente toman el
 * mutex anti-traslape (cron_locks con TTL) y rep-retry-nocturno inserta fila
 * a fila tolerante a 23505 (antes un traslape perdía el batch de alertas).
 *
 * Run: deno test --no-check --allow-read supabase/functions/_shared/cronLock_test.ts
 */
import { assert, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

async function leer(archivo: string): Promise<string> {
  return await Deno.readTextFile(new URL(archivo, import.meta.url));
}

const CRONS = [
  "../rep-retry-nocturno/index.ts",
  "../verificar-sat-semanal/index.ts",
  "../facturapi-reconciliar-cancelaciones/index.ts",
];

for (const archivo of CRONS) {
  Deno.test(`P3 crons: ${archivo} toma y suelta el mutex anti-traslape`, async () => {
    const src = await leer(archivo);
    assertStringIncludes(src, "tomarCronLock(");
    assertStringIncludes(src, 'if (lock === "ocupado")', "debe salir limpio cuando otro corre");
    assertStringIncludes(src, "soltarCronLock(");
    const idxTomar = src.indexOf("tomarCronLock(");
    const idxSoltar = src.indexOf("soltarCronLock(");
    assert(idxSoltar > idxTomar, "el unlock debe ir en el finally posterior");
  });
}

/** Busca la migración que contiene un marcador (el nombre de archivo lo asigna la plataforma). */
async function leerMigracionCon(marcador: string): Promise<string> {
  const dir = new URL("../../migrations/", import.meta.url);
  for await (const entrada of Deno.readDir(dir)) {
    if (!entrada.isFile || !entrada.name.endsWith(".sql")) continue;
    const src = await Deno.readTextFile(new URL(entrada.name, dir));
    if (src.includes(marcador)) return src;
  }
  throw new Error(`ninguna migración contiene ${marcador}`);
}

Deno.test("P3 crons: migración cron_locks con lease TTL y grants service_role", async () => {
  const src = await leerMigracionCon("CREATE TABLE IF NOT EXISTS public.cron_locks");
  assertStringIncludes(src, "CREATE TABLE IF NOT EXISTS public.cron_locks");
  assertStringIncludes(src, "cron_try_lock");
  assertStringIncludes(src, "cron_unlock");
  assertStringIncludes(src, "p_ttl_seconds");
  assertStringIncludes(src, "TO service_role");
  assertStringIncludes(src, "ENABLE ROW LEVEL SECURITY");
});

Deno.test("P3 crons: rep-retry inserta fila a fila y omite 23505 (no pierde el batch)", async () => {
  const src = await leer("../rep-retry-nocturno/index.ts");
  assertStringIncludes(src, 'upErr.code === "23505"');
  assert(!src.includes(".insert(nuevas)"), "quedó el insert en batch que reventaba completo");
});
