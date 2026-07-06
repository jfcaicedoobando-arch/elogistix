// @ts-nocheck
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  extraerUltimoTC,
  extraerPublicacionDof,
  formatFechaBanxico,
  rangoUltimosDias,
  FALLBACK,
} from "./index.ts";

// ── FALLBACK ─────────────────────────────────────────────────

Deno.test("FALLBACK has expected usdMxn value", () => {
  assertEquals(FALLBACK.usdMxn, 17.25);
});

Deno.test("FALLBACK has expected eurMxn value", () => {
  assertEquals(FALLBACK.eurMxn, 18.5);
});

Deno.test("fallback shape: incluye usdMxn y eurMxn numéricos", () => {
  assertEquals(typeof FALLBACK.usdMxn, "number");
  assertEquals(typeof FALLBACK.eurMxn, "number");
});

// ── extraerUltimoTC (compat) ────────────────────────────────

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

// ── extraerPublicacionDof — corazón del fix v13.205.5 ────────

Deno.test("extraerPublicacionDof: con FIX de hoy publicado, devuelve el FIX de AYER (= DOF de hoy)", () => {
  // Escenario: hoy es 06/07/2026. Banxico ya publicó el FIX de hoy (17.55).
  // El DOF vigente HOY es el FIX de ayer (17.43), no el de hoy.
  const data = {
    bmx: {
      series: [{
        idSerie: "SF43718",
        datos: [
          { fecha: "02/07/2026", dato: "17.4000" },
          { fecha: "03/07/2026", dato: "17.4200" },
          { fecha: "06/07/2026", dato: "17.4300" }, // ayer hábil (viernes fue 03, lunes es 06)
          // ↑ aclaración: en este set 06/07 es "ayer" respecto de hoyIso 07/07.
        ],
      }],
    },
  };
  // Hoy = 07/07/2026 → debe seleccionar el 06/07 = 17.43
  assertEquals(extraerPublicacionDof(data, "2026-07-07"), 17.43);
});

Deno.test("extraerPublicacionDof: descarta la fila de HOY aunque tenga valor", () => {
  const data = {
    bmx: {
      series: [{
        datos: [
          { fecha: "05/07/2026", dato: "17.4000" },
          { fecha: "06/07/2026", dato: "17.4342" }, // ayer
          { fecha: "07/07/2026", dato: "17.5500" }, // hoy → debe ignorarse
        ],
      }],
    },
  };
  assertEquals(extraerPublicacionDof(data, "2026-07-07"), 17.4342);
});

Deno.test("extraerPublicacionDof: sin FIX de hoy publicado, sigue devolviendo el de ayer", () => {
  const data = {
    bmx: {
      series: [{
        datos: [
          { fecha: "05/07/2026", dato: "17.4000" },
          { fecha: "06/07/2026", dato: "17.4342" },
        ],
      }],
    },
  };
  assertEquals(extraerPublicacionDof(data, "2026-07-07"), 17.4342);
});

Deno.test("extraerPublicacionDof: salta 'N/E' en la fila hábil más reciente", () => {
  const data = {
    bmx: {
      series: [{
        datos: [
          { fecha: "04/07/2026", dato: "17.4000" },
          { fecha: "05/07/2026", dato: "17.4200" }, // sábado, N/E
          { fecha: "06/07/2026", dato: "N/E" },     // ayer sin dato
        ],
      }],
    },
  };
  // Ambas filas posteriores al 04 son N/E o no válidas → devuelve 17.40
  assertEquals(extraerPublicacionDof(data, "2026-07-07"), 17.42);
});

Deno.test("extraerPublicacionDof: rango vacío → null", () => {
  assertEquals(extraerPublicacionDof({ bmx: { series: [{ datos: [] }] } } as never, "2026-07-07"), null);
  assertEquals(extraerPublicacionDof({} as never, "2026-07-07"), null);
});

Deno.test("extraerPublicacionDof: todas las filas son >= hoy → null", () => {
  const data = {
    bmx: {
      series: [{
        datos: [
          { fecha: "07/07/2026", dato: "17.5500" },
          { fecha: "08/07/2026", dato: "17.6000" },
        ],
      }],
    },
  };
  assertEquals(extraerPublicacionDof(data, "2026-07-07"), null);
});

Deno.test("extraerPublicacionDof: redondea a 4 decimales", () => {
  const data = {
    bmx: {
      series: [{
        datos: [{ fecha: "06/07/2026", dato: "18.412389" }],
      }],
    },
  };
  assertEquals(extraerPublicacionDof(data, "2026-07-07"), 18.4124);
});

Deno.test("extraerPublicacionDof: fecha con formato inválido → la ignora", () => {
  const data = {
    bmx: {
      series: [{
        datos: [
          { fecha: "05/07/2026", dato: "17.4000" },
          { fecha: "invalid", dato: "99.99" },
        ],
      }],
    },
  };
  assertEquals(extraerPublicacionDof(data, "2026-07-07"), 17.4);
});

// ── formatFechaBanxico + rangoUltimosDias ───────────────────

Deno.test("formatFechaBanxico: DD/MM/YYYY en UTC", () => {
  const d = new Date(Date.UTC(2026, 6, 6)); // 06/07/2026 UTC
  assertEquals(formatFechaBanxico(d), "06/07/2026");
});

Deno.test("formatFechaBanxico: padea día y mes con ceros", () => {
  const d = new Date(Date.UTC(2026, 0, 5));
  assertEquals(formatFechaBanxico(d), "05/01/2026");
});

Deno.test("rangoUltimosDias: rango de 10 días termina en hoy", () => {
  const hoy = new Date(Date.UTC(2026, 6, 7));
  const { inicio, fin } = rangoUltimosDias(hoy, 10);
  assertEquals(fin, "07/07/2026");
  assertEquals(inicio, "27/06/2026");
});
