/**
 * v13.492.0 — Un embarque en `Borrador` no puede mostrar fases avanzadas como
 * completadas. Regresión del caso ELIMP00323: estado `Borrador` con ETD
 * vencido se veía como confirmado y en tránsito.
 */
import { describe, it, expect } from "vitest";
import {
  calcularFasesEmbarque,
  etiquetaSiguientePaso,
  type EmbarqueFasesInput,
} from "../embarqueFases";

const base: EmbarqueFasesInput = {
  modo: "Marítimo",
  tipo: "Importación",
  estado: "Borrador",
  etd: "2020-01-01",
  eta: "2020-02-01",
  fecha_creacion: "2019-12-01T00:00:00Z",
  fecha_llegada_real: null,
  cotizacion_id: "cot-1",
  updated_at: "2019-12-01T00:00:00Z",
};

function porId(embarque: EmbarqueFasesInput) {
  const fases = calcularFasesEmbarque(embarque);
  return Object.fromEntries(fases.map((f) => [f.id, f]));
}

describe("fases de un embarque en Borrador", () => {
  it("la fase Confirmado es la actual y se etiqueta 'Por confirmar'", () => {
    const f = porId(base);
    expect(f.confirmado.estado).toBe("actual");
    expect(f.confirmado.label).toBe("Por confirmar");
  });

  it("no completa En Tránsito aunque el ETD ya venció", () => {
    expect(porId(base).en_transito.estado).toBe("pendiente");
  });

  it("no completa Arribo aunque haya fecha de llegada real capturada", () => {
    const f = porId({ ...base, fecha_llegada_real: "2020-02-05" });
    expect(f.arribo.estado).toBe("pendiente");
  });

  it("la propuesta sí se marca completada cuando viene de cotización", () => {
    expect(porId(base).cotizacion.estado).toBe("completada");
  });

  it("ya confirmado con ETD vencido sí completa Confirmado y En Tránsito", () => {
    const f = porId({ ...base, estado: "Confirmado" });
    expect(f.confirmado.estado).toBe("completada");
    expect(f.confirmado.label).toBe("Confirmado");
    expect(f.en_transito.estado).toBe("actual");
  });
});

/**
 * v13.823.164 (smoke 162): la barra del tab Resumen anunciaba "Siguiente: En
 * Tránsito" en un Borrador, contradiciendo el botón "Avanzar a Confirmado".
 */
describe("siguiente paso anunciado en la barra compacta", () => {
  it("en Borrador el siguiente paso es Confirmar, no En Tránsito", () => {
    const fases = calcularFasesEmbarque(base);
    const idx = fases.findIndex((f) => f.estado === "actual");
    expect(etiquetaSiguientePaso(fases, idx)).toBe("Confirmar el embarque");
  });

  it("ya confirmado sí anuncia la fase siguiente de la línea de tiempo", () => {
    const fases = calcularFasesEmbarque({ ...base, estado: "Confirmado" });
    const idx = fases.findIndex((f) => f.estado === "actual");
    expect(etiquetaSiguientePaso(fases, idx)).toBe("Arribo");
  });
});
