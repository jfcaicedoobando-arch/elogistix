import { describe, expect, it } from "vitest";
import { agruparHechosNegocio } from "@/features/embarques/domain/actividadAgrupacion";
import { descripcionHumana } from "@/features/embarques/domain/actividadDescripcion";
import type { ActividadItem } from "@/features/embarques/domain/actividadFeed";

const base: ActividadItem = {
  id: "x", categoria: "operacion", tipo: "evento", fecha: "2026-09-22T08:10:00Z",
  usuario: "ops@x.com", accion: "Otro", titulo: "",
};

describe("bitácora: una tarjeta por transición (#7)", () => {
  it("agrupa 'Avanzó estado' y 'Cambio de estado' con estado_nuevo en detalles", () => {
    const out = agruparHechosNegocio([
      { ...base, id: "a", accion: "Avanzó estado de embarque", titulo: "Avanzó estado", detalles: { estado_nuevo: "Confirmado" } },
      { ...base, id: "b", accion: "Cambio de estado", titulo: "Cambio de estado", detalles: { nuevoEstado: "Confirmado" } },
    ] as ActividadItem[]);
    expect(out).toHaveLength(1);
    expect(out[0].relacionados?.map((r) => r.id)).toEqual(["b"]);
  });

  it("no muestra claves técnicas en la descripción", () => {
    const txt = descripcionHumana("TipoEvento: Otro · NuevoEstado: Confirmado");
    expect(txt).not.toMatch(/TipoEvento|NuevoEstado/);
    expect(txt).toContain("Confirmado");
  });
});
