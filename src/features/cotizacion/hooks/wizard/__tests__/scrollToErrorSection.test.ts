/**
 * Tests para scrollToErrorSection (P0 — v13.293.1).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  seccionParaErrorPaso1,
  scrollAndFocusSection,
} from "@/features/cotizacion/hooks/wizard/scrollToErrorSection";

describe("seccionParaErrorPaso1", () => {
  it("mapea errores de cliente/prospecto/contacto", () => {
    expect(seccionParaErrorPaso1("Selecciona un cliente")).toBe("seccion-cliente");
    expect(seccionParaErrorPaso1("Falta el prospecto")).toBe("seccion-cliente");
    expect(seccionParaErrorPaso1("Contacto requerido")).toBe("seccion-cliente");
    expect(seccionParaErrorPaso1("Debes elegir empresa")).toBe("seccion-cliente");
  });

  it("mapea errores de operación", () => {
    expect(seccionParaErrorPaso1("Falta modalidad")).toBe("seccion-operacion");
    expect(seccionParaErrorPaso1("Selecciona equipo")).toBe("seccion-operacion");
    expect(seccionParaErrorPaso1("Punto de carga requerido")).toBe("seccion-operacion");
  });

  it("mapea errores de tarifa", () => {
    expect(seccionParaErrorPaso1("Debes elegir una tarifa")).toBe("seccion-tarifa");
  });

  it("cae al fallback seccion-cliente para mensajes desconocidos", () => {
    expect(seccionParaErrorPaso1("Algo raro pasó")).toBe("seccion-cliente");
  });
});

describe("scrollAndFocusSection", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("es no-op cuando el id no existe", () => {
    expect(() => scrollAndFocusSection("no-existe")).not.toThrow();
  });

  it("hace scrollIntoView y focus al primer input", () => {
    document.body.innerHTML = `
      <div id="seccion-cliente">
        <input id="primer" type="text" />
        <input id="segundo" type="text" />
      </div>
    `;
    const el = document.getElementById("seccion-cliente")!;
    const scrollSpy = vi.fn();
    el.scrollIntoView = scrollSpy;
    scrollAndFocusSection("seccion-cliente");
    expect(scrollSpy).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    vi.advanceTimersByTime(400);
    expect(document.activeElement?.id).toBe("primer");
    // Añade pulse.
    expect(el.classList.contains("ring-2")).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(el.classList.contains("ring-2")).toBe(false);
  });
});
