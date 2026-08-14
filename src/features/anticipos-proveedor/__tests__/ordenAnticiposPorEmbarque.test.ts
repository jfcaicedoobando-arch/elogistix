import { describe, expect, it } from "vitest";
import {
  esMismoEmbarque,
  ordenarAnticiposPorEmbarque,
} from "../domain/ordenAnticiposPorEmbarque";

const EMB_A = "11111111-1111-4111-8111-111111111111";
const EMB_B = "22222222-2222-4222-8222-222222222222";

describe("esMismoEmbarque", () => {
  it("es falso cuando el anticipo no tiene embarque", () => {
    expect(esMismoEmbarque(null, EMB_A)).toBe(false);
  });

  it("es falso cuando la factura no tiene embarque", () => {
    expect(esMismoEmbarque(EMB_A, null)).toBe(false);
  });

  it("es verdadero cuando coinciden", () => {
    expect(esMismoEmbarque(EMB_A, EMB_A)).toBe(true);
  });
});

describe("ordenarAnticiposPorEmbarque", () => {
  const anticipos = [
    { id: "sin", embarque_id: null, fecha_anticipo: "2026-01-01" },
    { id: "otro", embarque_id: EMB_B, fecha_anticipo: "2026-01-02" },
    { id: "mismo-nuevo", embarque_id: EMB_A, fecha_anticipo: "2026-03-01" },
    { id: "mismo-viejo", embarque_id: EMB_A, fecha_anticipo: "2026-02-01" },
  ];

  it("pone primero los del mismo embarque, del más antiguo al más nuevo", () => {
    const orden = ordenarAnticiposPorEmbarque(anticipos, EMB_A).map((a) => a.id);
    expect(orden.slice(0, 2)).toEqual(["mismo-viejo", "mismo-nuevo"]);
  });

  it("sin embarque de factura sólo ordena por fecha", () => {
    const orden = ordenarAnticiposPorEmbarque(anticipos, null).map((a) => a.id);
    expect(orden).toEqual(["sin", "otro", "mismo-viejo", "mismo-nuevo"]);
  });

  it("no muta el arreglo original de anticipos por embarque", () => {
    const copia = [...anticipos];
    ordenarAnticiposPorEmbarque(anticipos, EMB_A);
    expect(anticipos).toEqual(copia);
  });
});
