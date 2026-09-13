// v13.823.346 — Regresión: `action=prepare` exige rol de escritura de
// cotizaciones. Antes bastaba ser miembro de la organización para obtener una
// URL firmada de subida y sobrescribir el PDF de la cotización.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handlePrepare } from "./handlers.ts";

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
  const res = await handlePrepare(comoAdmin(fakeAdmin("viewer")), "org/cot/f.pdf", CORS, "u1", "org1");
  assertEquals(res.status, 403);
});

Deno.test("prepare: contador (finanzas) recibe 403", async () => {
  const res = await handlePrepare(comoAdmin(fakeAdmin("contador")), "org/cot/f.pdf", CORS, "u1", "org1");
  assertEquals(res.status, 403);
});

Deno.test("prepare: no miembro recibe 403", async () => {
  const res = await handlePrepare(comoAdmin(fakeAdmin(null)), "org/cot/f.pdf", CORS, "u1", "org1");
  assertEquals(res.status, 403);
});

Deno.test("prepare: vendedor obtiene la URL firmada", async () => {
  const res = await handlePrepare(comoAdmin(fakeAdmin("vendedor")), "org/cot/f.pdf", CORS, "u1", "org1");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.path, "org/cot/f.pdf");
});
