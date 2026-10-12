/**
 * Regresión local: un soft delete conserva UUID y estado, pero la factura
 * borrada debe quedar fuera del barrido manual y semanal.
 *
 * El mock ejecuta filtros sobre fixtures; fetch siempre devuelve SOAP local.
 * Run: deno test --cached-only --no-check --deny-net supabase/functions/_shared/satBarrido_softDelete_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  barrerOrganizacion,
  cargarFacturas,
  cargarFacturasPorAntiguedadVerificacion,
  type FilaFactura,
} from "./satBarrido.ts";
import { SAT_ENDPOINT } from "./satConsulta.ts";

type AdminClient = Parameters<typeof cargarFacturas>[0];

interface Fixture extends FilaFactura {
  organization_id: string;
  deleted_at: string | null;
  deleted_by: string | null;
  created_at: string;
  updated_at: string;
  uuid_estatus_sat: string | null;
  uuid_verificado_fecha: string | null;
  uuid_verificado: boolean;
  proveedores: { origen_proveedor: string };
}

interface UpdateRecord {
  ids: string[];
  patch: Record<string, unknown>;
}

type QueryResult = { data: Fixture[]; error: null };
type OrderSpec = {
  column: string;
  ascending: boolean;
  nullsFirst: boolean;
};

const ORG = "org-local";
const DELETED_AT = "2026-10-10T00:00:00.000Z";

function factura(id: string, overrides: Partial<Fixture> = {}): Fixture {
  return {
    id,
    organization_id: ORG,
    uuid_fiscal: "11111111-1111-4111-8111-111111111111",
    rfc_proveedor: "AAA010101AAA",
    total: 100,
    folio_interno: `F-${id}`,
    folio_proveedor: `P-${id}`,
    proveedor_nombre: "Proveedor local",
    estado: "Vigente",
    deleted_at: null,
    deleted_by: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-01T00:00:00.000Z",
    uuid_estatus_sat: null,
    uuid_verificado_fecha: null,
    uuid_verificado: false,
    proveedores: { origen_proveedor: "Nacional" },
    ...overrides,
  };
}

function valor(row: Fixture, column: string): unknown {
  return column.split(".").reduce<unknown>((value, part) => {
    if (value === null || typeof value !== "object") return undefined;
    return (value as Record<string, unknown>)[part];
  }, row);
}

/**
 * Subconjunto de PostgREST usado por estos selectores y su persistencia.
 * Los filtros se ejecutan antes de order/limit aunque se añadan después.
 * No sustituye a una prueba de integración de Supabase/RLS.
 */
class FixtureQuery implements PromiseLike<QueryResult> {
  rows: Fixture[];
  updates: UpdateRecord[];
  predicates: Array<(row: Fixture) => boolean> = [];
  orders: OrderSpec[] = [];
  maxRows: number | undefined;
  patch: Record<string, unknown> | undefined;

  constructor(rows: Fixture[], updates: UpdateRecord[]) {
    this.rows = rows;
    this.updates = updates;
  }

  select(_columns: string): this {
    return this;
  }

  eq(column: string, expected: unknown): this {
    this.predicates.push((row) => valor(row, column) === expected);
    return this;
  }

  not(column: string, operator: string, expected: unknown): this {
    assertEquals(operator, "is");
    this.predicates.push((row) => valor(row, column) !== expected);
    return this;
  }

  neq(column: string, expected: unknown): this {
    this.predicates.push((row) => {
      const actual = valor(row, column);
      return actual !== null && actual !== undefined && actual !== expected;
    });
    return this;
  }

  is(column: string, expected: unknown): this {
    this.predicates.push((row) => valor(row, column) === expected);
    return this;
  }

  in(column: string, expected: unknown[]): this {
    this.predicates.push((row) => expected.includes(valor(row, column)));
    return this;
  }

  order(column: string, options: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orders.push({
      column,
      ascending: options.ascending ?? true,
      nullsFirst: options.nullsFirst ?? false,
    });
    return this;
  }

  limit(count: number): this {
    this.maxRows = count;
    return this;
  }

  update(patch: Record<string, unknown>): this {
    this.patch = patch;
    return this;
  }

  execute(): QueryResult {
    let selected = this.rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
    selected.sort((a, b) => {
      for (const order of this.orders) {
        const left = valor(a, order.column);
        const right = valor(b, order.column);
        if (left === right) continue;
        if (left === null || left === undefined) return order.nullsFirst ? -1 : 1;
        if (right === null || right === undefined) return order.nullsFirst ? 1 : -1;
        const comparison = String(left) < String(right) ? -1 : 1;
        return order.ascending ? comparison : -comparison;
      }
      return 0;
    });
    if (this.maxRows !== undefined) selected = selected.slice(0, this.maxRows);
    if (this.patch !== undefined) {
      this.updates.push({ ids: selected.map((row) => row.id), patch: { ...this.patch } });
      for (const row of selected) Object.assign(row, this.patch);
    }
    return { data: structuredClone(selected), error: null };
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

function mockAdmin(fixtures: Fixture[]) {
  const rows = structuredClone(fixtures);
  const updates: UpdateRecord[] = [];
  const admin = {
    from(table: string) {
      assertEquals(table, "proveedor_facturas");
      return new FixtureQuery(rows, updates);
    },
  } as unknown as AdminClient;
  return { admin, rows, updates };
}

function fixturesSeleccion(): Fixture[] {
  return [
    factura("activa-nunca-vigente", { created_at: "2026-10-05T00:00:00.000Z" }),
    factura("borrada-vigente", {
      deleted_at: DELETED_AT,
      deleted_by: "usuario-local",
      updated_at: DELETED_AT,
      created_at: "2026-10-12T00:00:00.000Z",
    }),
    factura("activa-verificada-pagada", {
      estado: "Pagada",
      uuid_estatus_sat: "Vigente",
      uuid_verificado: true,
      uuid_verificado_fecha: "2026-10-02T00:00:00.000Z",
      created_at: "2026-10-04T00:00:00.000Z",
    }),
    factura("borrada-pagada", {
      estado: "Pagada",
      deleted_at: DELETED_AT,
      deleted_by: "usuario-local",
      updated_at: DELETED_AT,
      uuid_estatus_sat: "Vigente",
      uuid_verificado: true,
      uuid_verificado_fecha: "2026-09-01T00:00:00.000Z",
      created_at: "2026-10-11T00:00:00.000Z",
    }),
    factura("activa-nunca-pagada", {
      estado: "Pagada",
      created_at: "2026-10-06T00:00:00.000Z",
    }),
    factura("otra-organizacion", {
      organization_id: "org-ajena",
      created_at: "2026-10-13T00:00:00.000Z",
    }),
    factura("uuid-nulo", { uuid_fiscal: null, created_at: "2026-10-13T00:00:00.000Z" }),
    factura("extranjera", {
      proveedores: { origen_proveedor: "Extranjero" },
      created_at: "2026-10-13T00:00:00.000Z",
    }),
    factura("activa-otro-estado", {
      estado: "Cancelada",
      uuid_estatus_sat: "Vigente",
      uuid_verificado_fecha: "2026-08-01T00:00:00.000Z",
      created_at: "2026-10-03T00:00:00.000Z",
    }),
    factura("activa-verificada-reciente", {
      uuid_estatus_sat: "Vigente",
      uuid_verificado_fecha: "2026-10-04T00:00:00.000Z",
      created_at: "2026-10-07T00:00:00.000Z",
    }),
    factura("activa-nunca-tercera", { created_at: "2026-10-02T00:00:00.000Z" }),
  ];
}

Deno.test("manual completo excluye soft deletes y conserva alcance y datos activos", async () => {
  const fixtures = fixturesSeleccion();
  const { admin, updates } = mockAdmin(fixtures);
  const rows = await cargarFacturas(admin, ORG, false, 50);
  const expectedIds = [
    "activa-verificada-reciente",
    "activa-nunca-pagada",
    "activa-nunca-vigente",
    "activa-verificada-pagada",
    "activa-otro-estado",
    "activa-nunca-tercera",
  ];
  assertEquals(rows.map((row) => row.id), expectedIds);
  assertEquals(rows, expectedIds.map((id) => fixtures.find((row) => row.id === id)));
  assertEquals(updates, []);
});

Deno.test("manual sin verificar excluye soft deletes sin ampliar UUID, proveedor ni tenant", async () => {
  const { admin } = mockAdmin(fixturesSeleccion());
  const rows = await cargarFacturas(admin, ORG, true, 50);
  assertEquals(rows.map((row) => row.id), [
    "activa-nunca-pagada",
    "activa-nunca-vigente",
    "activa-nunca-tercera",
  ]);
});

Deno.test("manual aplica el límite sobre activas en orden de creación", async () => {
  const { admin } = mockAdmin(fixturesSeleccion());
  const rows = await cargarFacturas(admin, ORG, false, 2);
  assertEquals(rows.map((row) => row.id), ["activa-verificada-reciente", "activa-nunca-pagada"]);
});

Deno.test("semanal excluye soft deletes y conserva estados, tenant y prioridad de verificación", async () => {
  const fixtures = fixturesSeleccion();
  const { admin, updates } = mockAdmin(fixtures);
  const rows = await cargarFacturasPorAntiguedadVerificacion(admin, ORG, 50);
  // No se exige desempate entre las filas nunca verificadas.
  assertEquals(rows.slice(0, 3).map((row) => row.id).sort(), [
    "activa-nunca-pagada",
    "activa-nunca-tercera",
    "activa-nunca-vigente",
  ]);
  assertEquals(rows.slice(3).map((row) => row.id), [
    "activa-verificada-pagada",
    "activa-verificada-reciente",
  ]);
  assertEquals(rows, rows.map((row) => fixtures.find((fixture) => fixture.id === row.id)));
  assertEquals(updates, []);
});

Deno.test("semanal aplica el límite sobre activas con null primero y fecha antigua después", async () => {
  const { admin } = mockAdmin([
    factura("borrada-nunca", { deleted_at: DELETED_AT }),
    factura("activa-reciente", { uuid_verificado_fecha: "2026-10-09T00:00:00.000Z" }),
    factura("borrada-antigua", {
      estado: "Pagada",
      deleted_at: DELETED_AT,
      uuid_verificado_fecha: "2026-01-01T00:00:00.000Z",
    }),
    factura("activa-antigua", {
      estado: "Pagada",
      uuid_verificado_fecha: "2026-10-02T00:00:00.000Z",
    }),
    factura("activa-nunca"),
  ]);
  const rows = await cargarFacturasPorAntiguedadVerificacion(admin, ORG, 2);
  assertEquals(rows.map((row) => row.id), ["activa-nunca", "activa-antigua"]);
});

const selectoresProcesamiento = [
  { nombre: "manual completo", cargar: (admin: AdminClient) => cargarFacturas(admin, ORG, false, 50) },
  { nombre: "manual sin verificar", cargar: (admin: AdminClient) => cargarFacturas(admin, ORG, true, 50) },
  {
    nombre: "semanal",
    cargar: (admin: AdminClient) => cargarFacturasPorAntiguedadVerificacion(admin, ORG, 50),
  },
];

for (const selector of selectoresProcesamiento) {
  Deno.test(`${selector.nombre}: barrerOrganizacion sólo consulta y persiste la activa`, async () => {
    const { admin, rows, updates } = mockAdmin([
      factura("borrada-vigente", {
        uuid_fiscal: "22222222-2222-4222-8222-222222222222",
        deleted_at: DELETED_AT,
        deleted_by: "usuario-local",
        updated_at: DELETED_AT,
      }),
      factura("activa", { uuid_fiscal: "11111111-1111-4111-8111-111111111111" }),
      factura("borrada-pagada", {
        uuid_fiscal: "33333333-3333-4333-8333-333333333333",
        estado: "Pagada",
        deleted_at: DELETED_AT,
        deleted_by: "usuario-local",
        updated_at: DELETED_AT,
      }),
    ]);
    const borradasAntes = structuredClone(rows.filter((row) => row.deleted_at !== null));
    const activaAntes = structuredClone(rows.find((row) => row.id === "activa"));
    const calls: { url: string; method: string | undefined; uuid: string | null }[] = [];
    const originalFetch = globalThis.fetch;
    // Nunca se delega al fetch original: todas las respuestas son locales.
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({
        url: String(_input),
        method: init?.method,
        uuid: /&amp;id=([^<]+)/.exec(String(init?.body ?? ""))?.[1] ?? null,
      });
      return Promise.resolve(new Response(
        '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
          '<ConsultaResponse><ConsultaResult><Estado>Vigente</Estado>' +
          '<CodigoEstatus>S - Comprobante obtenido satisfactoriamente.</CodigoEstatus>' +
          '</ConsultaResult></ConsultaResponse></s:Body></s:Envelope>',
        { status: 200, headers: { "Content-Type": "text/xml" } },
      ));
    }) as typeof fetch;
    try {
      const seleccionadas = await selector.cargar(admin);
      const out = await barrerOrganizacion(admin, ORG, seleccionadas, "BBB010101BBB");
      assertEquals(calls, [{
        url: SAT_ENDPOINT,
        method: "POST",
        uuid: "11111111-1111-4111-8111-111111111111",
      }]);
      assertEquals(updates.map((update) => update.ids), [["activa"]]);
      assertEquals(updates[0].patch.uuid_verificado, true);
      assertEquals(updates[0].patch.uuid_estatus_sat, "Vigente");
      assertEquals(Number.isNaN(Date.parse(String(updates[0].patch.uuid_verificado_fecha))), false);
      assertEquals(Object.keys(updates[0].patch).sort(), [
        "uuid_estatus_sat", "uuid_verificado", "uuid_verificado_fecha",
      ]);
      assertEquals(rows.filter((row) => row.deleted_at !== null), borradasAntes);
      const activaDespues = rows.find((row) => row.id === "activa");
      assertEquals(activaDespues, {
        ...activaAntes,
        uuid_verificado: true,
        uuid_estatus_sat: "Vigente",
        uuid_verificado_fecha: updates[0].patch.uuid_verificado_fecha,
      });
      assertEquals(out.total, 1);
      assertEquals(out.procesadas, 1);
      assertEquals(out.resumen, {
        Vigente: 1,
        Cancelado: 0,
        "No Encontrado": 0,
        "No verificable": 0,
        Error: 0,
        omitidas: 0,
      });
      assertEquals(out.canceladas, []);
      assertEquals(out.fallos, []);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}
