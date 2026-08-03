import { describe, it, expect } from "vitest";
import {
  FILTROS_BITACORA_TESORERIA_INICIALES,
  filtrarOrdenarBitacoraTesoreria,
  hayFiltrosBitacoraActivos,
  usuariosBitacora,
} from "../bitacoraTesoreriaFiltros";

const entradas = [
  { accion: "pagar", created_at: "2026-07-01T10:00:00Z", usuario_email: "ana@x.mx" },
  { accion: "eliminar_pago", created_at: "2026-07-15T10:00:00Z", usuario_email: "beto@x.mx" },
  { accion: "pagar", created_at: "2026-08-01T10:00:00Z", usuario_email: "ana@x.mx" },
];

describe("bitacoraTesoreriaFiltros", () => {
  it("ordena por fecha descendente por omisión", () => {
    const r = filtrarOrdenarBitacoraTesoreria(entradas, FILTROS_BITACORA_TESORERIA_INICIALES);
    expect(r.map((e) => e.created_at)).toEqual([
      "2026-08-01T10:00:00Z", "2026-07-15T10:00:00Z", "2026-07-01T10:00:00Z",
    ]);
  });

  it("ordena por fecha ascendente", () => {
    const r = filtrarOrdenarBitacoraTesoreria(entradas, {
      ...FILTROS_BITACORA_TESORERIA_INICIALES, orden: "antiguo",
    });
    expect(r[0].created_at).toBe("2026-07-01T10:00:00Z");
  });

  it("filtra por tipo de movimiento", () => {
    const r = filtrarOrdenarBitacoraTesoreria(entradas, {
      ...FILTROS_BITACORA_TESORERIA_INICIALES, tipo: "eliminar_pago",
    });
    expect(r).toHaveLength(1);
    expect(r[0].usuario_email).toBe("beto@x.mx");
  });

  it("filtra por usuario", () => {
    const r = filtrarOrdenarBitacoraTesoreria(entradas, {
      ...FILTROS_BITACORA_TESORERIA_INICIALES, usuario: "ana@x.mx",
    });
    expect(r).toHaveLength(2);
  });

  it("filtra por rango de fechas inclusivo", () => {
    const r = filtrarOrdenarBitacoraTesoreria(entradas, {
      ...FILTROS_BITACORA_TESORERIA_INICIALES, desde: "2026-07-15", hasta: "2026-08-01",
    });
    expect(r).toHaveLength(2);
  });

  it("no muta el arreglo original", () => {
    const copia = [...entradas];
    filtrarOrdenarBitacoraTesoreria(entradas, FILTROS_BITACORA_TESORERIA_INICIALES);
    expect(entradas).toEqual(copia);
  });

  it("lista usuarios únicos ordenados", () => {
    expect(usuariosBitacora(entradas)).toEqual(["ana@x.mx", "beto@x.mx"]);
  });

  it("detecta filtros activos", () => {
    expect(hayFiltrosBitacoraActivos(FILTROS_BITACORA_TESORERIA_INICIALES)).toBe(false);
    expect(hayFiltrosBitacoraActivos({
      ...FILTROS_BITACORA_TESORERIA_INICIALES, usuario: "ana@x.mx",
    })).toBe(true);
    expect(hayFiltrosBitacoraActivos({
      ...FILTROS_BITACORA_TESORERIA_INICIALES, orden: "antiguo",
    })).toBe(false);
  });
});
