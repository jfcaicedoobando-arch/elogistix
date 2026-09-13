// v13.823.346 — Regresión: `action=prepare` exige rol de escritura de
// cotizaciones. Antes bastaba ser miembro de la organización para obtener una
// URL firmada de subida y sobrescribir el PDF de la cotización.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handlePrepare } from "./handlers.ts";

// deno-lint-ignore no-explicit-any
function chain(result: unknown): any {
  // deno-lint-ignore no-explicit-any
  const o: any = { eq: () => o, maybeSingle: () => Promise.resolve({ data: result }) };
  return o;
}

function fakeAdmin(rolOrg: string | null) {
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
    // deno-lint-ignore no-explicit-any
  } as any;
}

const CORS = { "Access-Control-Allow-Origin": "*" };

Deno.test("prepare: viewer recibe 403", async () => {
  const res = await handlePrepare(fakeAdmin("viewer"), "org/cot/f.pdf", CORS, "u1", "org1");
  assertEquals(res.status, 403);
});

Deno.test("prepare: contador (finanzas) recibe 403", async () => {
  const res = await handlePrepare(fakeAdmin("contador"), "org/cot/f.pdf", CORS, "u1", "org1");
  assertEquals(res.status, 403);
});

Deno.test("prepare: no miembro recibe 403", async () => {
  const res = await handlePrepare(fakeAdmin(null), "org/cot/f.pdf", CORS, "u1", "org1");
  assertEquals(res.status, 403);
});

Deno.test("prepare: vendedor obtiene la URL firmada", async () => {
  const res = await handlePrepare(fakeAdmin("vendedor"), "org/cot/f.pdf", CORS, "u1", "org1");
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.path, "org/cot/f.pdf");
});
