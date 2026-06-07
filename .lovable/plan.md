# Plan: arreglar `src/services/configuracion/__tests__/index.test.ts`

## Problemas actuales

1. Reimplementa a mano una cadena thenable en vez de usar `createSupabaseMock` (viola `mem://technical/testing-mock-patterns`).
2. El `then` mock es síncrono, no acepta `reject`, no devuelve Promise — frágil y propenso a leaks de microtask.
3. Estado mutable (`_data`, `_error`) sin reset entre tests.
4. Usa `as any` (viola Power of 10).
5. Cobertura muy pobre: 1 solo caso para todo el módulo (no cubre `fetchConfiguracion`, ni `updateConfiguracionByCategoriaClave`, ni propagación de errores).

## Cambios

### `src/services/configuracion/__tests__/index.test.ts` (reescribir)

Migrar al patrón estándar del proyecto:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchConfiguracionByOrg,
  fetchConfiguracion,
  updateConfiguracionByCategoriaClave,
} from "../index";

describe("configuracion service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    vi.clearAllMocks();
  });

  it("fetchConfiguracionByOrg filtra por organization_id", async () => {
    mock.setTableResult("configuracion", { data: [], error: null });
    await fetchConfiguracionByOrg("org1");
    const call = mock.tableCalls.find(c => c.table === "configuracion");
    expect(call?.ops).toEqual(expect.arrayContaining(["select", "eq", "order", "order"]));
  });

  it("fetchConfiguracionByOrg propaga error de Supabase", async () => {
    mock.setTableResult("configuracion", { data: null, error: { message: "boom" } });
    await expect(fetchConfiguracionByOrg("org1")).rejects.toBeDefined();
  });

  it("fetchConfiguracion devuelve [] cuando data es null", async () => {
    mock.setTableResult("configuracion", { data: null, error: null });
    const res = await fetchConfiguracion();
    expect(res).toEqual([]);
  });

  it("updateConfiguracionByCategoriaClave hace update por item", async () => {
    mock.setTableResult("configuracion", { data: null, error: null });
    await updateConfiguracionByCategoriaClave([
      { categoria: "empresa", clave: "nombre", valor: "X" },
      { categoria: "empresa", clave: "rfc", valor: "Y" },
    ]);
    const calls = mock.tableCalls.filter(c => c.table === "configuracion");
    expect(calls.length).toBe(2);
    expect(calls[0].ops).toContain("update");
  });
});
```

## Notas

- Quita por completo el thenable manual y el `as any`.
- Añade `beforeEach` con reset explícito (`tableCalls.length = 0` + `vi.clearAllMocks()`).
- Pasa de 1 a 4 casos cubriendo happy path, error path y mutación.
- **No** se modifica `src/services/configuracion/index.ts` (el código de producción ya es correcto).
- **No** se toca versión ni CHANGELOG porque es cambio interno de tests sin impacto al usuario (a confirmar contigo si prefieres bump de patch).

## Aclaración importante

Este cambio **no resolverá el hang del shard 9/16**. Como ya identifiqué, este test es trivial y no abre handles; el timeout se origina en teardown del worker o en la carga de `ReporteEjecutivoDocument.test.tsx`. Esta refactorización es higiene de calidad, no un fix del CI.
