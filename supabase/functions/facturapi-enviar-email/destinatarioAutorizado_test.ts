/**
 * P0-1 — Cobertura de resolverDestinatarioAutorizado: fuente autorizada,
 * override manual (bloqueado/permitido) y que NO se disparen campos muertos
 * en la bitácora (fuente_email/override_manual ya no existen en el shape).
 * Run: deno test --no-check supabase/functions/facturapi-enviar-email/destinatarioAutorizado_test.ts
 */
// @ts-nocheck — Deno runtime.
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolverDestinatarioAutorizado } from "./destinatarioAutorizado.ts";

interface Escenario {
  contactos: Array<{ email: string; tipo: string }>;
  clienteEmail: string | null;
  membresia: { role: string } | null;
}

function crearClienteFalso(esc: Escenario) {
  const cliente = {
    from(tabla: string) {
      const builder: Record<string, unknown> = {};
      const chain = () => builder;
      builder.select = chain;
      builder.eq = chain;
      builder.is = chain;
      builder.not = chain;
      builder.order = chain;
      builder.limit = chain;
      builder.in = chain;
      builder.maybeSingle = () => {
        if (tabla === "clientes") return Promise.resolve({ data: esc.clienteEmail ? { email: esc.clienteEmail } : null });
        if (tabla === "organization_members") return Promise.resolve({ data: esc.membresia });
        return Promise.resolve({ data: null });
      };
      builder.then = (resolve: (v: unknown) => unknown) => {
        if (tabla === "contactos_cliente") return Promise.resolve({ data: esc.contactos }).then(resolve);
        return Promise.resolve({ data: [] }).then(resolve);
      };
      builder.insert = () => Promise.resolve({ error: null });
      return builder;
    },
  };
  return cliente;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

Deno.test("resolverDestinatarioAutorizado: usa el contacto de facturación del cliente", async () => {
  const supabase = crearClienteFalso({
    contactos: [{ email: "cobranza@cliente.mx", tipo: "facturacion" }],
    clienteEmail: "general@cliente.mx",
    membresia: null,
  });
  const r = await resolverDestinatarioAutorizado({
    supabase, json, userId: "u1", userEmail: "yo@empresa.mx",
    organizationId: "org-1", clienteId: "cli-1",
  });
  assert(!(r instanceof Response));
  assertEquals((r as { email: string }).email, "cobranza@cliente.mx");
  assertEquals((r as { emailDistintoSugerido: boolean }).emailDistintoSugerido, false);
});

Deno.test("resolverDestinatarioAutorizado: override manual permitido con rol de envío a terceros", async () => {
  const supabase = crearClienteFalso({
    contactos: [], clienteEmail: null,
    membresia: { role: "admin" },
  });
  const r = await resolverDestinatarioAutorizado({
    supabase, json, userId: "u1", userEmail: "yo@empresa.mx",
    organizationId: "org-1", clienteId: "cli-1", emailSolicitado: "externo@ajeno.mx",
  });
  assert(!(r instanceof Response));
  assertEquals((r as { email: string }).email, "externo@ajeno.mx");
});

Deno.test("resolverDestinatarioAutorizado: override manual bloqueado sin rol de envío a terceros", async () => {
  const supabase = crearClienteFalso({
    contactos: [], clienteEmail: null,
    membresia: { role: "operador" },
  });
  const r = await resolverDestinatarioAutorizado({
    supabase, json, userId: "u1", userEmail: "yo@empresa.mx",
    organizationId: "org-1", clienteId: "cli-1", emailSolicitado: "externo@ajeno.mx",
  });
  assert(r instanceof Response);
  assertEquals((r as Response).status, 403);
});

Deno.test("resolverDestinatarioAutorizado: sin email disponible responde 422", async () => {
  const supabase = crearClienteFalso({ contactos: [], clienteEmail: null, membresia: null });
  const r = await resolverDestinatarioAutorizado({
    supabase, json, userId: "u1", userEmail: undefined,
    organizationId: "org-1", clienteId: "cli-1",
  });
  assert(r instanceof Response);
  assertEquals((r as Response).status, 422);
});

Deno.test("index.ts: la bitácora ya no referencia identificadores inexistentes", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(!src.includes("resolucion.emailSugerido"), "no debe quedar referencia muerta a `resolucion`");
  assert(!src.includes("overrideManual"), "no debe quedar referencia muerta a `overrideManual`");
  assert(src.includes("email_distinto_sugerido: emailDistintoSugerido"), "debe seguir registrando el campo vigente");
});
