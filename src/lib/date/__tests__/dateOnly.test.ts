import { describe, it, expect, afterEach, vi } from "vitest";
import { parseDateOnlyLocal, diasHastaFecha } from "../dateOnly";

afterEach(() => {
  vi.useRealTimers();
});

describe("parseDateOnlyLocal (B-089)", () => {
  it("ancla un date-only a medianoche LOCAL, no UTC", () => {
    const d = parseDateOnlyLocal("2026-07-28");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(6);
    expect(d.getDate()).toBe(28);
    expect(d.getHours()).toBe(0);
  });

  it("no retrocede un día respecto de new Date() en zonas al oeste de UTC", () => {
    const local = parseDateOnlyLocal("2026-01-01");
    // El parseo nativo del date-only es medianoche UTC: en México cae el 31/dic.
    expect(local.getDate()).toBe(1);
  });

  it("delega al parseo nativo cuando el string trae hora", () => {
    const d = parseDateOnlyLocal("2026-07-28T15:30:00Z");
    expect(d.toISOString()).toBe("2026-07-28T15:30:00.000Z");
  });
});

describe("diasHastaFecha (B-089)", () => {
  const hoy = new Date(2026, 6, 28, 23, 45, 0); // 28/07/2026 casi medianoche local

  it("una tarifa que vence hoy da 0 (no -1)", () => {
    expect(diasHastaFecha("2026-07-28", hoy)).toBe(0);
  });

  it("cuenta días futuros", () => {
    expect(diasHastaFecha("2026-08-04", hoy)).toBe(7);
  });

  it("cuenta días pasados en negativo", () => {
    expect(diasHastaFecha("2026-07-21", hoy)).toBe(-7);
  });

  it("es inmune al cambio de horario (DST) en el rango", () => {
    // México aplicaba DST en abril; el redondeo evita el 6.958 → 6.
    const base = new Date(2026, 2, 30, 12, 0, 0);
    expect(diasHastaFecha("2026-04-06", base)).toBe(7);
  });

  it("un umbral ≤ 7 días no incluye la de 8 días", () => {
    expect(diasHastaFecha("2026-08-05", hoy) <= 7).toBe(false);
  });

  it("usa la fecha actual cuando no se pasa base", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 28, 6, 0, 0));
    expect(diasHastaFecha("2026-07-30")).toBe(2);
  });
});

describe("addDaysIso", () => {
  it("suma días naturales sin desfase de zona horaria", () => {
    expect(addDaysIso("2026-07-27", 60)).toBe("2026-09-25");
    expect(addDaysIso("2026-07-22", 30)).toBe("2026-08-21");
  });

  it("con 0 días devuelve la misma fecha (vence el día de emisión)", () => {
    expect(addDaysIso("2026-07-27", 0)).toBe("2026-07-27");
  });

  it("cruza fin de mes y año bisiesto", () => {
    expect(addDaysIso("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDaysIso("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("acepta un ISO completo tomando sólo la parte de fecha", () => {
    expect(addDaysIso("2026-07-27T18:30:00Z", 1)).toBe("2026-07-28");
  });

  it("devuelve null con entradas inválidas", () => {
    expect(addDaysIso(null, 30)).toBeNull();
    expect(addDaysIso("", 30)).toBeNull();
    expect(addDaysIso("27/07/2026", 30)).toBeNull();
    expect(addDaysIso("2026-07-27", Number.NaN)).toBeNull();
  });
});
