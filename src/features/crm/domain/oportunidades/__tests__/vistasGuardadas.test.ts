import { describe, it, expect } from "vitest";
import {
  buildVistasGuardadas,
  detectarVistaActiva,
} from "../vistasGuardadas";
import { FILTROS_DEFAULT } from "@/features/crm/components/oportunidadesFiltersTypes";

const HOY = new Date(2026, 6, 15); // 15/07/2026 local

describe("buildVistasGuardadas", () => {
  it('marca "Mis deals" no disponible sin usuario', () => {
    const v = buildVistasGuardadas({ hoy: HOY });
    expect(v.find((x) => x.id === "mis-deals")?.disponible).toBe(false);
  });

  it('filtra por el vendedor actual en "Mis deals"', () => {
    const v = buildVistasGuardadas({ userId: "u-1", hoy: HOY });
    const mis = v.find((x) => x.id === "mis-deals");
    expect(mis?.disponible).toBe(true);
    expect(mis?.filtros.vendedorId).toBe("u-1");
  });

  it('usa el mes local completo en "Cierra este mes"', () => {
    const v = buildVistasGuardadas({ hoy: HOY });
    const mes = v.find((x) => x.id === "cierra-mes");
    expect(mes?.filtros.cierreDesde).toBe("2026-07-01");
    expect(mes?.filtros.cierreHasta).toBe("2026-07-31");
  });

  it("respeta el umbral de alto valor", () => {
    const v = buildVistasGuardadas({ hoy: HOY, umbralAltoValor: 10_000 });
    expect(v.find((x) => x.id === "alto-valor")?.filtros.montoMin).toBe("10000");
  });
});

describe("detectarVistaActiva", () => {
  const vistas = buildVistasGuardadas({ userId: "u-1", hoy: HOY });

  it("detecta la vista por defecto", () => {
    expect(detectarVistaActiva(FILTROS_DEFAULT, vistas)).toBe("todas");
  });

  it("detecta una vista aplicada", () => {
    const mes = vistas.find((v) => v.id === "cierra-mes")!;
    expect(detectarVistaActiva(mes.filtros, vistas)).toBe("cierra-mes");
  });

  it("devuelve null con filtros manuales", () => {
    expect(
      detectarVistaActiva({ ...FILTROS_DEFAULT, etapaId: "etapa-x" }, vistas),
    ).toBeNull();
  });
});
