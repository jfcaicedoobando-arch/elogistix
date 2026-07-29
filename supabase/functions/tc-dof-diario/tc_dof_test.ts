/**
 * Tests del cron `tc-dof-diario` (helpers puros) y del parser DOF compartido.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { checkCronSecret, fechasObjetivo, normalizarDias } from "./index.ts";
import { extraerPublicacionDof, formatFechaBanxico } from "../_shared/banxicoDof.ts";

Deno.test("checkCronSecret exige coincidencia exacta", () => {
  assertEquals(checkCronSecret("abc", "abc"), true);
  assertEquals(checkCronSecret("abc", "otro"), false);
  assertEquals(checkCronSecret(undefined, null), false);
  assertEquals(checkCronSecret("", ""), false);
});

Deno.test("normalizarDias acota entre 1 y 90", () => {
  assertEquals(normalizarDias(undefined), 1);
  assertEquals(normalizarDias(0), 1);
  assertEquals(normalizarDias(-5), 1);
  assertEquals(normalizarDias("30"), 30);
  assertEquals(normalizarDias(1000), 90);
  assertEquals(normalizarDias(7.9), 7);
});

Deno.test("fechasObjetivo devuelve N días hacia atrás desde hoy", () => {
  const hoy = new Date("2026-07-29T12:00:00Z");
  const fechas = fechasObjetivo(hoy, 3).map(formatFechaBanxico);
  assertEquals(fechas, ["2026-07-29", "2026-07-28", "2026-07-27"]);
});

Deno.test("extraerPublicacionDof toma el día hábil anterior y reporta su fecha", () => {
  const data = {
    bmx: {
      series: [{
        datos: [
          { fecha: "24/07/2026", dato: "17.40" },
          { fecha: "28/07/2026", dato: "17.4342" },
          { fecha: "29/07/2026", dato: "17.50" }, // FIX de hoy → DOF de mañana
        ],
      }],
    },
  };
  const r = extraerPublicacionDof(data, "2026-07-29");
  assertEquals(r.tc, 17.4342);
  assertEquals(r.fechaAplicada, "2026-07-28");
});

Deno.test("extraerPublicacionDof ignora N/E y datos vacíos", () => {
  const data = {
    bmx: { series: [{ datos: [{ fecha: "27/07/2026", dato: "17.10" }, { fecha: "28/07/2026", dato: "N/E" }] }] },
  };
  assertEquals(extraerPublicacionDof(data, "2026-07-29").tc, 17.1);
  assertEquals(extraerPublicacionDof({ bmx: { series: [{ datos: [] }] } }, "2026-07-29").tc, null);
});
