/**
 * Q-04 — Casos frontera de `accionesCotizacionPermitidas`.
 * Cubre total 0 / total > 0 para cada estado relevante.
 */
import { describe, it, expect } from "vitest";
import { accionesCotizacionPermitidas } from "@/features/cotizacion/domain/cotizacion";

const ROL_GESTOR = "admin" as const;

describe("accionesCotizacionPermitidas", () => {
  it("exportarPdf siempre es true, sin importar estado, total o rol", () => {
    expect(accionesCotizacionPermitidas("Borrador", 0, null).exportarPdf).toBe(true);
    expect(accionesCotizacionPermitidas("Vencida", 100, ROL_GESTOR).exportarPdf).toBe(true);
  });

  describe("estado Borrador", () => {
    it("total 0: no permite enviar ni aceptar/rechazar", () => {
      const r = accionesCotizacionPermitidas("Borrador", 0, ROL_GESTOR);
      expect(r.enviar).toBe(false);
      expect(r.aceptar).toBe(false);
      expect(r.rechazar).toBe(false);
    });

    it("total > 0: permite enviar, no aceptar/rechazar", () => {
      const r = accionesCotizacionPermitidas("Borrador", 100, ROL_GESTOR);
      expect(r.enviar).toBe(true);
      expect(r.aceptar).toBe(false);
      expect(r.rechazar).toBe(false);
    });
  });

  describe("estado Solicitada", () => {
    it("total 0: no permite enviar", () => {
      expect(accionesCotizacionPermitidas("Solicitada", 0, ROL_GESTOR).enviar).toBe(false);
    });

    it("total > 0: permite enviar", () => {
      expect(accionesCotizacionPermitidas("Solicitada", 100, ROL_GESTOR).enviar).toBe(true);
    });
  });

  describe("estado Enviada", () => {
    it("total 0: no permite aceptar ni rechazar", () => {
      const r = accionesCotizacionPermitidas("Enviada", 0, ROL_GESTOR);
      expect(r.aceptar).toBe(false);
      expect(r.rechazar).toBe(false);
    });

    it("total > 0: permite aceptar y rechazar", () => {
      const r = accionesCotizacionPermitidas("Enviada", 100, ROL_GESTOR);
      expect(r.aceptar).toBe(true);
      expect(r.rechazar).toBe(true);
    });
  });

  describe("estado Aceptada", () => {
    it("no permite enviar ni aceptar/rechazar, con o sin total", () => {
      const conTotal = accionesCotizacionPermitidas("Aceptada", 100, ROL_GESTOR);
      const sinTotal = accionesCotizacionPermitidas("Aceptada", 0, ROL_GESTOR);
      for (const r of [conTotal, sinTotal]) {
        expect(r.enviar).toBe(false);
        expect(r.aceptar).toBe(false);
        expect(r.rechazar).toBe(false);
      }
    });
  });

  describe("estado Rechazada", () => {
    it("no permite ninguna acción de flujo, con o sin total", () => {
      const conTotal = accionesCotizacionPermitidas("Rechazada", 100, ROL_GESTOR);
      const sinTotal = accionesCotizacionPermitidas("Rechazada", 0, ROL_GESTOR);
      for (const r of [conTotal, sinTotal]) {
        expect(r.enviar).toBe(false);
        expect(r.aceptar).toBe(false);
        expect(r.rechazar).toBe(false);
      }
    });
  });

  describe("estado Vencida", () => {
    it("no permite ninguna acción de flujo, con o sin total", () => {
      const conTotal = accionesCotizacionPermitidas("Vencida", 100, ROL_GESTOR);
      const sinTotal = accionesCotizacionPermitidas("Vencida", 0, ROL_GESTOR);
      for (const r of [conTotal, sinTotal]) {
        expect(r.enviar).toBe(false);
        expect(r.aceptar).toBe(false);
        expect(r.rechazar).toBe(false);
      }
    });
  });

  it("rol sin permiso de gestión (null) nunca habilita enviar/aceptar/rechazar", () => {
    const r = accionesCotizacionPermitidas("Enviada", 100, null);
    expect(r.enviar).toBe(false);
    expect(r.aceptar).toBe(false);
    expect(r.rechazar).toBe(false);
  });
});
