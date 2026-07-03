// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { extraerUltimoTC, FALLBACK } from "./index.ts";

// ── FALLBACK ─────────────────────────────────────────────────

Deno.test("FALLBACK has expected usdMxn value", () => {
  assertEquals(FALLBACK.usdMxn, 17.25);
});

Deno.test("FALLBACK has expected eurMxn value", () => {
  assertEquals(FALLBACK.eurMxn, 18.5);
});

// ── extraerUltimoTC: parseo de respuesta Banxico SIE ────────

Deno.test("extraerUltimoTC: extrae el último dato numérico válido", () => {
  const data = {
    bmx: {
      series: [{
        idSerie: "SF43718",
        datos: [
          { fecha: "01/07/2026", dato: "18.4523" },
          { fecha: "02/07/2026", dato: "18.5012" },
        ],
      }],
    },
  };
  assertEquals(extraerUltimoTC(data), 18.5012);
});

Deno.test("extraerUltimoTC: ignora valores 'N/E' y toma el previo válido", () => {
  const data = {
    bmx: {
      series: [{
        idSerie: "SF43718",
        datos: [
          { fecha: "01/07/2026", dato: "18.4523" },
          { fecha: "02/07/2026", dato: "N/E" },
        ],
      }],
    },
  };
  assertEquals(extraerUltimoTC(data), 18.4523);
});

Deno.test("extraerUltimoTC: respuesta vacía → null", () => {
  assertEquals(extraerUltimoTC({} as never), null);
  assertEquals(extraerUltimoTC({ bmx: { series: [] } } as never), null);
});

Deno.test("extraerUltimoTC: redondea a 4 decimales", () => {
  const data = {
    bmx: {
      series: [{
        datos: [{ fecha: "02/07/2026", dato: "18.412345" }],
      }],
    },
  };
  assertEquals(extraerUltimoTC(data), 18.4123);
});

// ── Contrato del fallback ────────────────────────────────────

Deno.test("fallback shape: incluye usdMxn y eurMxn numéricos", () => {
  assertEquals(typeof FALLBACK.usdMxn, "number");
  assertEquals(typeof FALLBACK.eurMxn, "number");
});
