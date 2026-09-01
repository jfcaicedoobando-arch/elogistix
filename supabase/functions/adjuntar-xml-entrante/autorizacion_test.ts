/**
 * Ola P2 — Pruebas de la validación de documento/ruta previa a Storage.
 */
// deno-lint-ignore no-import-prefix
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  type DocumentoBuzon,
  pathPerteneceAlDocumento,
  prefijoCanonico,
  respuestaRechazo,
  validarDocumento,
} from "./autorizacion.ts";

const ORG = "11111111-1111-1111-1111-111111111111";
const EMB = "22222222-2222-2222-2222-222222222222";
const OTRA_ORG = "33333333-3333-3333-3333-333333333333";

const doc: DocumentoBuzon = {
  id: "doc-1",
  organization_id: ORG,
  embarque_id: EMB,
  estado: "por_capturar",
};

Deno.test("prefijoCanonico usa {org}/{embarque}/", () => {
  assertEquals(prefijoCanonico(ORG, EMB), `${ORG}/${EMB}/`);
});

Deno.test("acepta sólo rutas dentro del prefijo canónico del documento", () => {
  assertEquals(
    pathPerteneceAlDocumento(`${ORG}/${EMB}/abc123-factura.xml`, ORG, EMB),
    true,
  );
});

Deno.test("rechaza traversal, rutas absolutas, backslash y subcarpetas", () => {
  const malos = [
    "",
    `${ORG}/${EMB}/../../otro.xml`,
    `/${ORG}/${EMB}/a.xml`,
    `${ORG}/${EMB}/sub/a.xml`,
    `${ORG}/${EMB}/`,
    `${ORG}\\${EMB}\\a.xml`,
  ];
  for (const p of malos) {
    assertEquals(pathPerteneceAlDocumento(p, ORG, EMB), false, p);
  }
});

Deno.test("rechaza rutas de otra organización o de otro embarque", () => {
  assertEquals(
    pathPerteneceAlDocumento(`${OTRA_ORG}/${EMB}/a.xml`, ORG, EMB),
    false,
  );
  assertEquals(
    pathPerteneceAlDocumento(
      `${ORG}/44444444-4444-4444-4444-444444444444/a.xml`,
      ORG,
      EMB,
    ),
    false,
  );
  // Prefijo "parecido" que sólo comparte inicio de cadena.
  assertEquals(
    pathPerteneceAlDocumento(`${ORG}/${EMB}extra/a.xml`, ORG, EMB),
    false,
  );
});

Deno.test("documento inexistente y documento de otra org dan el MISMO motivo (sin oráculo)", () => {
  const a = validarDocumento({
    documento: null,
    orgActor: ORG,
    xmlPath: `${ORG}/${EMB}/a.xml`,
  });
  const b = validarDocumento({
    documento: doc,
    orgActor: OTRA_ORG,
    xmlPath: `${ORG}/${EMB}/a.xml`,
  });
  assertEquals(a, { ok: false, motivo: "no_encontrado" });
  assertEquals(b, { ok: false, motivo: "no_encontrado" });
  assertEquals(respuestaRechazo("no_encontrado").status, 404);
});

Deno.test("documento ya capturado: estado_invalido 409", () => {
  const r = validarDocumento({
    documento: { ...doc, estado: "capturado" },
    orgActor: ORG,
    xmlPath: `${ORG}/${EMB}/a.xml`,
  });
  assertEquals(r, { ok: false, motivo: "estado_invalido" });
  assertEquals(respuestaRechazo("estado_invalido").status, 409);
});

Deno.test("path de otro documento de la misma org: path_invalido 400", () => {
  const r = validarDocumento({
    documento: doc,
    orgActor: ORG,
    xmlPath: `${ORG}/55555555-5555-5555-5555-555555555555/a.xml`,
  });
  assertEquals(r, { ok: false, motivo: "path_invalido" });
  assertEquals(respuestaRechazo("path_invalido").status, 400);
});

Deno.test("caso feliz: documento propio, por capturar y ruta canónica", () => {
  assertEquals(
    validarDocumento({
      documento: doc,
      orgActor: ORG,
      xmlPath: `${ORG}/${EMB}/hash-a.xml`,
    }),
    { ok: true },
  );
});

Deno.test("index autoriza la org derivada del documento antes de descargar Storage", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const idxDocumento = src.indexOf('.from("embarque_facturas_entrantes")');
  const idxAutoriza = src.indexOf("await autorizarCxp(");
  const idxDescarga = src.indexOf("await descargarYParsear(");
  assertEquals(idxDocumento > 0, true);
  assertEquals(idxDocumento < idxAutoriza, true);
  assertEquals(idxAutoriza < idxDescarga, true);
  assertEquals(src.includes("organizationId: documento.organization_id"), true);
  assertEquals(src.includes("organization_id: input"), false);
});
