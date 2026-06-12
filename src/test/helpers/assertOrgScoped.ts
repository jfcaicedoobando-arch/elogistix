/**
 * Helper de aislamiento multi-tenant para tests (Fase 2 auditoría 12.83.0).
 *
 * Verifica que una query a Supabase incluyó `.eq("organization_id", orgId)`
 * o `.eq("<custom>", orgId)` — útil para asegurar que ningún servicio
 * filtra sin scope organizacional.
 *
 * Uso:
 *   const mock = createSupabaseMock();
 *   await fetchAlgo("org-1");
 *   assertOrgScoped(mock.tableCalls, "embarques", "org-1");
 */
import { expect } from "vitest";
import type { TableCall } from "@/services/__tests__/_supabaseChainMock";

export function assertOrgScoped(
  tableCalls: readonly TableCall[],
  table: string,
  orgId: string,
  column = "organization_id",
): void {
  const calls = tableCalls.filter((c) => c.table === table);
  expect(calls.length, `No hubo llamadas a tabla "${table}"`).toBeGreaterThan(0);
  const found = calls.some((call) =>
    call.ops.some((op, i) => {
      if (op !== "eq") return false;
      const args = call.opArgs[i] ?? [];
      return args[0] === column && args[1] === orgId;
    }),
  );
  expect(
    found,
    `Tabla "${table}" no fue filtrada por .eq("${column}", "${orgId}")`,
  ).toBe(true);
}
