import { describe, it, expect } from "vitest";
import { hoyMx, ymMx, parseLocalMx, primerDiaMesMx, ultimoDiaMesMx } from "@/lib/date/mx";

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

describe("primerDiaMesMx / ultimoDiaMesMx (FIX-3/FIX-8)", () => {
  it("primerDiaMesMx(0) devuelve el primer día del mes en curso (CDMX)", () => {
    const at = new Date(Date.UTC(2026, 5, 20, 18, 0, 0)); // 20-jun 12:00 CDMX
    expect(primerDiaMesMx(0, at)).toBe("2026-06-01");
  });

  it("primerDiaMesMx(1) cruza a enero del año siguiente en diciembre", () => {
    const at = new Date(Date.UTC(2026, 11, 20, 18, 0, 0));
    expect(primerDiaMesMx(1, at)).toBe("2027-01-01");
  });

  it("ultimoDiaMesMx(0) devuelve el último día del mes en curso", () => {
    const at = new Date(Date.UTC(2026, 1, 10, 18, 0, 0)); // feb 2026 (no bisiesto)
    expect(ultimoDiaMesMx(0, at)).toBe("2026-02-28");
  });

  it("ultimoDiaMesMx(5) da el último día del sexto mes de la ventana", () => {
    const at = new Date(Date.UTC(2026, 5, 20, 18, 0, 0)); // jun 2026
    expect(ultimoDiaMesMx(5, at)).toBe("2026-11-30");
  });
});
