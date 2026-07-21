import { describe, it, expect } from "vitest";
import { hoyMx, ymMx, parseLocalMx } from "@/lib/date/mx";

describe("mx date helpers", () => {
  it("hoyMx devuelve fecha CDMX a las 22h del día 15 (aún día 15, no 16)", () => {
    // 2026-03-16T02:00:00Z == 2026-03-15T20:00:00-06:00 (CDMX sin horario de verano)
    const at = new Date(Date.UTC(2026, 2, 16, 2, 0, 0));
    expect(hoyMx(at)).toBe("2026-03-15");
  });

  it("ymMx respeta el mes local", () => {
    // 1 de abril UTC 03:00 == 31 de marzo 21:00 CDMX
    const at = new Date(Date.UTC(2026, 3, 1, 3, 0, 0));
    expect(ymMx(at)).toBe("2026-03");
  });

  it("parseLocalMx no corre el día por UTC", () => {
    const d = parseLocalMx("2026-03-15");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(15);
  });
});
