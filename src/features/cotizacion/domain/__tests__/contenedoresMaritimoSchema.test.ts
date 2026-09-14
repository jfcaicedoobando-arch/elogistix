/**
 * v13.823.396 · Q1 — Marítimo FCL exige número Y tipo de contenedor en el Paso 1.
 * Antes "Siguiente" dejaba pasar sin tipo y el contenedor del embarque nacía
 * con el tipo vacío.
 */
import { describe, it, expect } from "vitest";
import { contenedoresMaritimoSchema } from "@/features/cotizacion/domain/schemas/wizardPasosContenedores";
import { primerError } from "@/features/cotizacion/domain/schemas/wizardPasos";
import { COPY_VALIDACION } from "@/lib/copy/publicoCopy";
import { campoParaErrorPaso1 } from "@/features/cotizacion/hooks/wizard/scrollToErrorSection";

const base = { modo: "Marítimo", tipoEmbarque: "FCL", numContenedores: 2 };

describe("contenedoresMaritimoSchema · Q1", () => {
  it("exige el tipo de contenedor en FCL", () => {
    expect(primerError(contenedoresMaritimoSchema, { ...base, tipoContenedor: "" })).toBe(
      COPY_VALIDACION.tipoContenedorRequerido,
    );
    expect(primerError(contenedoresMaritimoSchema, { ...base, tipoContenedor: null })).toBe(
      COPY_VALIDACION.tipoContenedorRequerido,
    );
  });

  it("no acepta espacios como tipo de contenedor", () => {
    expect(primerError(contenedoresMaritimoSchema, { ...base, tipoContenedor: "   " })).toBe(
      COPY_VALIDACION.tipoContenedorRequerido,
    );
  });

  it("pasa con tipo de contenedor capturado", () => {
    expect(primerError(contenedoresMaritimoSchema, { ...base, tipoContenedor: "40HC" })).toBeNull();
  });

  it("el número de contenedores se sigue validando primero", () => {
    expect(
      primerError(contenedoresMaritimoSchema, { ...base, numContenedores: 0, tipoContenedor: "" }),
    ).toBe(COPY_VALIDACION.contenedoresRequeridos);
  });

  it("LCL y otros modos no exigen tipo de contenedor", () => {
    expect(
      primerError(contenedoresMaritimoSchema, { ...base, tipoEmbarque: "LCL", tipoContenedor: "" }),
    ).toBeNull();
    expect(
      primerError(contenedoresMaritimoSchema, { ...base, modo: "Aéreo", tipoContenedor: "" }),
    ).toBeNull();
  });

  it("el error lleva el foco a la sección Mercancía", () => {
    expect(campoParaErrorPaso1(COPY_VALIDACION.tipoContenedorRequerido)).toBe("tipoContenedor");
  });
});
