/**
 * P1-3: `marcarRevisado` es el mecanismo que garantiza que un fallo
 * individual no detiene el lote — el llamador lo invoca en un `finally`
 * (ver `reconcileOne`/`reconcileOneNc`/`reconcileOneRep` en index.ts/reps.ts)
 * así que debe tolerar ejecutarse tras cualquier resultado.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { marcarRevisado, type CursorSupabase } from "./cursor.ts";

function fakeSupabase(calls: Array<{ tabla: string; campo: string; id: string }>): CursorSupabase {
  return {
    from: (tabla: string) => ({
      update: (v: Record<string, unknown>) => ({
        eq: (_c: string, id: string) => {
          const [campo] = Object.keys(v);
          calls.push({ tabla, campo, id });
          return Promise.resolve({ error: null });
        },
      }),
    }),
  };
}

Deno.test("marcarRevisado: escribe el campo correcto por tabla", async () => {
  const calls: Array<{ tabla: string; campo: string; id: string }> = [];
  const supabase = fakeSupabase(calls);
  await marcarRevisado(supabase, "facturas", "reconciliacion_checked_at", "f1", "2026-01-01T00:00:00Z");
  await marcarRevisado(supabase, "pagos_factura", "rep_reconciliacion_checked_at", "p1", "2026-01-01T00:00:00Z");
  assertEquals(calls, [
    { tabla: "facturas", campo: "reconciliacion_checked_at", id: "f1" },
    { tabla: "pagos_factura", campo: "rep_reconciliacion_checked_at", id: "p1" },
  ]);
});

/**
 * Simula el patrón try/finally usado en index.ts/reps.ts: un ítem que lanza
 * excepción durante su procesamiento igual termina marcando el cursor, y el
 * bucle exterior (que envuelve cada ítem en su propio try/catch a nivel de
 * item, vía la función `reconcileOne*`) sigue con el siguiente sin abortar.
 */
async function procesarItemConCursor(
  supabase: CursorSupabase,
  id: string,
  falla: boolean,
): Promise<void> {
  try {
    if (falla) throw new Error("fallo simulado");
  } finally {
    await marcarRevisado(supabase, "facturas", "reconciliacion_checked_at", id, "2026-01-01T00:00:00Z");
  }
}

Deno.test("lote: un fallo individual no detiene el procesamiento del resto", async () => {
  const calls: Array<{ tabla: string; campo: string; id: string }> = [];
  const supabase = fakeSupabase(calls);
  const items = [
    { id: "f1", falla: false },
    { id: "f2", falla: true },
    { id: "f3", falla: false },
  ];
  let procesados = 0;
  for (const item of items) {
    try {
      await procesarItemConCursor(supabase, item.id, item.falla);
      procesados++;
    } catch {
      // El manejo real vive dentro de reconcileOne* (catch interno + resumen.errores++);
      // aquí sólo probamos que el bucle exterior no se detiene ante una excepción.
      procesados++;
    }
  }
  assertEquals(procesados, 3);
  assertEquals(calls.map((c) => c.id), ["f1", "f2", "f3"]);
});
