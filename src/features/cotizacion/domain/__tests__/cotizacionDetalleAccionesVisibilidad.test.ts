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
