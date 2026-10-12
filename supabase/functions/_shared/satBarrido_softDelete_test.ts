/**
 * Regresión local: el soft delete conserva UUID y estado, pero queda fuera del barrido.
 * El mock ejecuta filtros sobre fixtures y fetch devuelve únicamente SOAP local.
 * Run: deno test --cached-only --deny-net supabase/functions/_shared/satBarrido_softDelete_test.ts
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { barrerOrganizacion, cargarFacturas, cargarFacturasPorAntiguedadVerificacion } from "./satBarrido.ts";
import { SAT_ENDPOINT } from "./satConsulta.ts";
import { ORG, DELETED_AT, factura, fixturesSeleccion, fixturePorId } from "./_test_helpers/satBarridoSoftDeleteFixtures.ts";
import { mockAdmin, type AdminClient } from "./_test_helpers/satBarridoSoftDeleteMock.ts";

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
  assertEquals(rows, expectedIds.map((id) => fixturePorId(fixtures, id)));
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
  assertEquals(rows, rows.map((row) => fixturePorId(fixtures, row.id)));
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
    const activaAntes = structuredClone(fixturePorId(rows, "activa"));
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
      const fechaVerificacion = updates[0].patch.uuid_verificado_fecha;
      if (typeof fechaVerificacion !== "string") {
        throw new Error("La fecha de verificación debe ser string");
      }
      assertEquals(Number.isNaN(Date.parse(fechaVerificacion)), false);
      assertEquals(Object.keys(updates[0].patch).sort(), [
        "uuid_estatus_sat", "uuid_verificado", "uuid_verificado_fecha",
      ]);
      assertEquals(rows.filter((row) => row.deleted_at !== null), borradasAntes);
      const activaDespues = fixturePorId(rows, "activa");
      assertEquals(activaDespues, {
        ...activaAntes,
        uuid_verificado: true,
        uuid_estatus_sat: "Vigente",
        uuid_verificado_fecha: fechaVerificacion,
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
