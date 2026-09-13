/**
 * v13.823.355 (YAGNI r2 · P1) — ciclo de vida del envío por correo.
 * Espejo en cliente de los candados de `enviar-cotizacion-email`.
 */
import { describe, it, expect } from "vitest";
import { cotizacionEnviablePorCorreo } from "@/features/cotizacion/domain/envioCotizacion";

describe("cotizacionEnviablePorCorreo", () => {
  it("bloquea prospecto sin oportunidad ligada", () => {
    expect(cotizacionEnviablePorCorreo({ estado: "Borrador", es_prospecto: true, oportunidad_id: null })).toBe(false);
  });

  it("permite prospecto con oportunidad ligada", () => {
    expect(cotizacionEnviablePorCorreo({ estado: "Borrador", es_prospecto: true, oportunidad_id: "op1" })).toBe(true);
  });

  it("bloquea estados terminales no vigentes", () => {
    for (const estado of ["Rechazada", "Vencida", "Archivada"]) {
      expect(cotizacionEnviablePorCorreo({ estado })).toBe(false);
    }
  });

  it("permite reenvío de Enviada y Aceptada", () => {
    expect(cotizacionEnviablePorCorreo({ estado: "Enviada" })).toBe(true);
    expect(cotizacionEnviablePorCorreo({ estado: "Aceptada" })).toBe(true);
  });
});
