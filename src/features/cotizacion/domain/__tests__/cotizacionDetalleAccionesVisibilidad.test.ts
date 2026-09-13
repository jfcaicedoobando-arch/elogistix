/**
 * Bug 6 (COT-2026-0012) — una cotización que ya tiene embarque vinculado no
 * debe ofrecer "Crear embarque", ni siquiera con un rol autorizado por
 * CREAR_EMBARQUE_BORRADOR: la puerta de embarque exige `!tieneEmbarquesVinculados`.
 */
import { describe, it, expect } from "vitest";
import { visibilidadAcciones } from "@/features/cotizacion/domain/cotizacionDetalleAccionesVisibilidad";

const base = {
  estado: "Aceptada",
  esProspecto: false,
  puedeAceptar: false,
  puedeRechazar: false,
  puedeAltaCliente: false,
  tieneOportunidad: false,
  tieneVenta: true,
  puedeCrearEmbarque: true,
  puedeRecotizar: true,
};

describe("visibilidadAcciones — embarque ya vinculado", () => {
  it("oculta 'Crear embarque' cuando la cotización ya tiene embarque vinculado", () => {
    const vis = visibilidadAcciones({ ...base, tieneEmbarquesVinculados: true });
    expect(vis.mostrarCrearEmbarque).toBe(false);
  });

  it("tampoco ofrece re-cotizar con embarque ya vinculado", () => {
    const vis = visibilidadAcciones({ ...base, tieneEmbarquesVinculados: true });
    expect(vis.mostrarRecotizar).toBe(false);
  });

  it("sí ofrece 'Crear embarque' cuando aún no hay embarque vinculado", () => {
    const vis = visibilidadAcciones({ ...base, tieneEmbarquesVinculados: false });
    expect(vis.mostrarCrearEmbarque).toBe(true);
  });
});

/**
 * v13.823.347 — `crear_embarque_borrador_core` acepta Aceptada o En operación.
 * Una cotización En operación sin embarque debe poder generarlo (antes el aviso
 * de la tarjeta apuntaba a un botón que no se renderizaba).
 */
describe("visibilidadAcciones — estado En operación sin embarque", () => {
  const enOperacion = { ...base, estado: "En operación", tieneEmbarquesVinculados: false };

  it("ofrece 'Crear embarque' al rol de operación", () => {
    expect(visibilidadAcciones(enOperacion).mostrarCrearEmbarque).toBe(true);
  });

  it("no ofrece 'Crear embarque' a un rol sin permiso", () => {
    const vis = visibilidadAcciones({ ...enOperacion, puedeCrearEmbarque: false });
    expect(vis.mostrarCrearEmbarque).toBe(false);
  });

  it("no ofrece 'Re-cotizar' (la RPC exige Aceptada)", () => {
    expect(visibilidadAcciones(enOperacion).mostrarRecotizar).toBe(false);
  });

  it("avisa la falta de venta en vez del botón cuando no hay importes", () => {
    const vis = visibilidadAcciones({ ...enOperacion, tieneVenta: false });
    expect(vis.mostrarCrearEmbarque).toBe(false);
    expect(vis.mostrarFaltaVenta).toBe(true);
  });
});
