// v13.823.346 — Regresión: `action=prepare` exige rol de escritura de
// cotizaciones. Antes bastaba ser miembro de la organización para obtener una
// URL firmada de subida y sobrescribir el PDF de la cotización.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handlePrepare } from "./handlers.ts";

/** Cotización mínima vigente y no prospecto. */
// SAFE-CAST: doble de prueba con los campos que leen los candados de envío.
const cotBase = (extra: Record<string, unknown> = {}) =>
  ({ id: "c1", folio: "COT-1", organization_id: "org1", estado: "Borrador", ...extra }) as unknown as Parameters<typeof handlePrepare>[4];

/** Cadena mínima con las operaciones que usa `authorizeOrgRole`. */
interface FakeChain {
  eq: (columna: string, valor: unknown) => FakeChain;
  maybeSingle: () => Promise<{ data: unknown }>;
}

interface FakeAdmin {
  from: (tabla: string) => { select: (cols: string) => FakeChain };
  storage: {
    from: (bucket: string) => {
      createSignedUploadUrl: (
        ruta: string,
      ) => Promise<{ data: { signedUrl: string; token: string }; error: null }>;
    };
  };
}

function chain(result: unknown): FakeChain {
  const o: FakeChain = {
    eq: () => o,
    maybeSingle: () => Promise.resolve({ data: result }),
  };
  return o;
}

function fakeAdmin(rolOrg: string | null): FakeAdmin {
  return {
    from(tabla: string) {
      if (tabla === "organization_members") {
        return { select: () => chain(rolOrg ? { role: rolOrg } : null) };
      }
      return { select: () => chain(null) };
    },
    storage: {
      from: () => ({
        createSignedUploadUrl: () =>
          Promise.resolve({ data: { signedUrl: "https://x/u", token: "tok" }, error: null }),
      }),
    },
  };
}

// El handler recibe el cliente real de Supabase; el fake sólo implementa las
// rutas que ejercita la prueba, de ahí el cast estructural puntual.
// SAFE-CAST: doble de prueba con la superficie mínima usada por handlePrepare.
const comoAdmin = (a: FakeAdmin) => a as unknown as Parameters<typeof handlePrepare>[0];

const CORS = { "Access-Control-Allow-Origin": "*" };

Deno.test("prepare: viewer recibe 403", async () => {
  const res = await handlePrepare(comoAdmin(fakeAdmin("viewer")), "org/cot/f.pdf", CORS, "u1", cotBase());
  assertEquals(res.status, 403);
});

Deno.test("prepare: contador (finanzas) recibe 403", async () => {
  const res = await handlePrepare(comoAdmin(fakeAdmin("contador")), "org/cot/f.pdf", CORS, "u1", cotBase());
  assertEquals(res.status, 403);
});

Deno.test("prepare: no miembro recibe 403", async () => {
  const res = await handlePrepare(comoAdmin(fakeAdmin(null)), "org/cot/f.pdf", CORS, "u1", cotBase());
  assertEquals(res.status, 403);
});

Deno.test("prepare: vendedor obtiene la URL firmada", async () => {
  const res = await handlePrepare(comoAdmin(fakeAdmin("vendedor")), "org/cot/f.pdf", CORS, "u1", cotBase());
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.path, "org/cot/f.pdf");
});

// v13.823.355 (YAGNI r2 · P1): la UI ocultaba el botón, pero la función podía
// invocarse directo. Los candados viven ahora en la edge function.
Deno.test("prepare: prospecto sin oportunidad ⇒ LC_COT_SIN_OPORTUNIDAD", async () => {
  const res = await handlePrepare(
    comoAdmin(fakeAdmin("vendedor")),
    "org/cot/f.pdf",
    CORS,
    "u1",
    cotBase({ es_prospecto: true, oportunidad_id: null }),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).code, "LC_COT_SIN_OPORTUNIDAD");
});

Deno.test("prepare: estado Vencida ⇒ LC_COT_ESTADO_NO_ENVIABLE", async () => {
  const res = await handlePrepare(
    comoAdmin(fakeAdmin("vendedor")),
    "org/cot/f.pdf",
    CORS,
    "u1",
    cotBase({ estado: "Vencida" }),
  );
  assertEquals(res.status, 400);
  assertEquals((await res.json()).code, "LC_COT_ESTADO_NO_ENVIABLE");
});

Deno.test("prepare: prospecto con oportunidad ligada sí prepara", async () => {
  const res = await handlePrepare(
    comoAdmin(fakeAdmin("vendedor")),
    "org/cot/f.pdf",
    CORS,
    "u1",
    cotBase({ es_prospecto: true, oportunidad_id: "op1" }),
  );
  assertEquals(res.status, 200);
});
