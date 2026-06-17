import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  fallbackResult,
  parseCategoriasJson,
  parseToolCallResponse,
  type Categoria,
} from "./aiHelpers.ts";

const cats: Categoria[] = [
  { id: "cat-1", nombre: "Fletes" },
  { id: "cat-2", nombre: "Maniobras" },
];

Deno.test("fallbackResult concatena descripciones con '; ' y recorta a 240", () => {
  const r = fallbackResult([{ descripcion: "A" }, { descripcion: "B" }]);
  assertEquals(r.categoria_id, null);
  assertEquals(r.notas, "A; B");
});

Deno.test("fallbackResult con array vacío devuelve notas vacías", () => {
  assertEquals(fallbackResult([]).notas, "");
});

Deno.test("fallbackResult recorta a 240 caracteres", () => {
  const long = "x".repeat(300);
  assertEquals(fallbackResult([{ descripcion: long }]).notas.length, 240);
});

Deno.test("parseToolCallResponse devuelve null si no hay tool_calls", () => {
  assertEquals(parseToolCallResponse({ choices: [] }, cats), null);
  assertEquals(parseToolCallResponse({}, cats), null);
});

Deno.test("parseToolCallResponse devuelve null si arguments es JSON inválido", () => {
  const j = { choices: [{ message: { tool_calls: [{ function: { arguments: "no-json" } }] } }] };
  assertEquals(parseToolCallResponse(j, cats), null);
});

Deno.test("parseToolCallResponse acepta categoria_id válida", () => {
  const j = {
    choices: [{
      message: { tool_calls: [{ function: { arguments: JSON.stringify({ categoria_id: "cat-1", notas: "ok" }) } }] },
    }],
  };
  const r = parseToolCallResponse(j, cats);
  assert(r);
  assertEquals(r?.categoria_id, "cat-1");
  assertEquals(r?.notas, "ok");
});

Deno.test("parseToolCallResponse anula categoria_id desconocido (anti-alucinación)", () => {
  const j = {
    choices: [{
      message: { tool_calls: [{ function: { arguments: JSON.stringify({ categoria_id: "cat-INVENTADA", notas: "x" }) } }] },
    }],
  };
  const r = parseToolCallResponse(j, cats);
  assertEquals(r?.categoria_id, null);
});

Deno.test("parseToolCallResponse recorta notas a 240", () => {
  const long = "y".repeat(500);
  const j = {
    choices: [{
      message: { tool_calls: [{ function: { arguments: JSON.stringify({ categoria_id: "", notas: long }) } }] },
    }],
  };
  assertEquals(parseToolCallResponse(j, cats)?.notas.length, 240);
});

Deno.test("parseCategoriasJson maneja null, vacío y JSON inválido", () => {
  assertEquals(parseCategoriasJson(null), []);
  assertEquals(parseCategoriasJson(""), []);
  assertEquals(parseCategoriasJson("{not json"), []);
  assertEquals(parseCategoriasJson(JSON.stringify({ no: "array" })), []);
});

Deno.test("parseCategoriasJson filtra entradas inválidas y limita a 50", () => {
  const arr = [
    { id: "1", nombre: "Uno" },
    { id: 2, nombre: "Mal" },
    { id: "3" },
    null,
    { id: "4", nombre: "Cuatro" },
  ];
  const r = parseCategoriasJson(JSON.stringify(arr));
  assertEquals(r.map(c => c.id), ["1", "4"]);

  const big = Array.from({ length: 80 }, (_, i) => ({ id: String(i), nombre: `n${i}` }));
  assertEquals(parseCategoriasJson(JSON.stringify(big)).length, 50);
});
