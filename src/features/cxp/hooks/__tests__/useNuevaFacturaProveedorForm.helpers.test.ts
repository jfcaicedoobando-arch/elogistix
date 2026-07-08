/**
 * Tests para helpers puros de `useNuevaFacturaProveedorForm`.
 * Sin React, sin Supabase: pura lógica de cálculo, validación y mapeo.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  addDays,
  today,
  initialValues,
  calcularTotal,
  validateFactura,
  embarqueIdUnico,
  buildPayload,
  mapCfdiToValues,
  type VinculoLinea,
  type PendingCfdi,
} from "../useNuevaFacturaProveedorForm.helpers";

describe("useNuevaFacturaProveedorForm.helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("addDays", () => {
    it("suma días correctamente", () => {
      expect(addDays("2026-01-01", 30)).toBe("2026-01-31");
      expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    });
    it("acepta cero días", () => {
      expect(addDays("2026-06-15", 0)).toBe("2026-06-15");
    });
    it("salta año", () => {
      expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    });
    it("devuelve '' cuando la emisión está vacía o es inválida (Sentry JAVASCRIPT-REACT-29)", () => {
      expect(addDays("", 30)).toBe("");
      expect(addDays("2026-13-40", 30)).toBe("");
      expect(addDays("no-es-fecha", 30)).toBe("");
    });
  });

  describe("today", () => {
    it("retorna ISO YYYY-MM-DD del system time", () => {
      expect(today()).toBe("2026-06-15");
    });
  });

  describe("initialValues", () => {
    it("usa today y 30 días de crédito por defecto", () => {
      const v = initialValues();
      expect(v.emision).toBe("2026-06-15");
      expect(v.vencimiento).toBe("2026-07-15");
      expect(v.diasCredito).toBe(30);
      expect(v.moneda).toBe("MXN");
      expect(v.provId).toBe("");
      expect(v.folio).toBe("");
    });
  });

  describe("calcularTotal", () => {
    it("suma subtotal + iva - retenciones", () => {
      const v = { ...initialValues(), subtotal: "1000", iva: "160", retenciones: "20" };
      expect(calcularTotal(v)).toBe(1140);
    });
    it("trata strings vacíos como 0", () => {
      const v = { ...initialValues(), subtotal: "", iva: "", retenciones: "" };
      expect(calcularTotal(v)).toBe(0);
    });
    it("trata strings no-numéricos como 0", () => {
      const v = { ...initialValues(), subtotal: "abc", iva: "100", retenciones: "" };
      expect(calcularTotal(v)).toBe(100);
    });
  });

  describe("validateFactura", () => {
    it("retorna errores para campos vacíos", () => {
      const errs = validateFactura(initialValues(), 0);
      expect(errs.provId).toBeDefined();
      expect(errs.folio).toBeDefined();
      expect(errs.categoriaId).toBeDefined();
      expect(errs.subtotal).toBeDefined();
    });
    it("pasa cuando todo está completo en MXN", () => {
      const v = {
        ...initialValues(),
        provId: "p1",
        folio: "F-1",
        categoriaId: "c1",
        subtotal: "1000",
      };
      const errs = validateFactura(v, 1000);
      expect(Object.keys(errs)).toHaveLength(0);
    });
    it("requiere tc cuando moneda no es MXN", () => {
      const v = {
        ...initialValues(),
        provId: "p1",
        folio: "F-1",
        categoriaId: "c1",
        subtotal: "100",
        moneda: "USD" as const,
        tc: "",
      };
      const errs = validateFactura(v, 100);
      expect(errs.tc).toBeDefined();
    });
    it("acepta tc>0 con moneda USD", () => {
      const v = {
        ...initialValues(),
        provId: "p1",
        folio: "F-1",
        categoriaId: "c1",
        subtotal: "100",
        moneda: "USD" as const,
        tc: "18.5",
      };
      const errs = validateFactura(v, 100);
      expect(errs.tc).toBeUndefined();
    });
    it("trim del folio: espacios solo => error", () => {
      const v = { ...initialValues(), provId: "p", folio: "   ", categoriaId: "c", subtotal: "10" };
      const errs = validateFactura(v, 10);
      expect(errs.folio).toBeDefined();
    });
  });

  describe("embarqueIdUnico", () => {
    const mkVinculo = (embarqueId: string): VinculoLinea => ({
      embarqueId,
      montoOriginal: 100,
      descripcion: "x",
      monto: 100,
    });
    it("retorna id cuando todos los vínculos son del mismo embarque", () => {
      const v = { a: mkVinculo("e1"), b: mkVinculo("e1") };
      expect(embarqueIdUnico(v)).toBe("e1");
    });
    it("retorna null cuando hay embarques distintos", () => {
      const v = { a: mkVinculo("e1"), b: mkVinculo("e2") };
      expect(embarqueIdUnico(v)).toBeNull();
    });
    it("retorna null con cero vínculos", () => {
      expect(embarqueIdUnico({})).toBeNull();
    });
  });

  describe("buildPayload", () => {
    it("construye payload con datos esperados", () => {
      const values = {
        ...initialValues(),
        provId: "p1",
        provNombre: "Acme",
        folio: " F-1 ",
        diasCredito: 15,
        moneda: "USD" as const,
        tc: "18.5",
        subtotal: "1000",
        iva: "160",
        retenciones: "20",
        categoriaId: "cat1",
        notas: "n",
      };
      const payload = buildPayload({
        values,
        total: 1140,
        userId: "u1",
        pendingCfdi: null,
        vinculos: {},
      });
      expect(payload.proveedor_id).toBe("p1");
      expect(payload.folio_proveedor).toBe("F-1");
      expect(payload.dias_credito).toBe(15);
      expect(payload.tipo_cambio_usd).toBe(18.5);
      expect(payload.total).toBe(1140);
      expect(payload.estado).toBe("Vigente");
      expect(payload.uuid_fiscal).toBeNull();
      expect(payload.embarque_id).toBeNull();
      expect(payload.created_by).toBe("u1");
    });
    it("propaga uuid y rfc desde pendingCfdi", () => {
      const cfdi: PendingCfdi = {
        uuid: "U-1",
        rfcEmisor: "ABC010101AAA",
        xmlFile: new File([""], "x.xml"),
        pdfFile: null,
      };
      const payload = buildPayload({
        values: initialValues(),
        total: 0,
        userId: undefined,
        pendingCfdi: cfdi,
        vinculos: {},
      });
      expect(payload.uuid_fiscal).toBe("U-1");
      expect(payload.rfc_proveedor).toBe("ABC010101AAA");
    });
    it("setea embarque_id cuando todos vínculos comparten embarque", () => {
      const v: Record<string, VinculoLinea> = {
        a: { embarqueId: "E-1", montoOriginal: 50, descripcion: "x", monto: 50 },
      };
      const payload = buildPayload({
        values: initialValues(),
        total: 0,
        userId: "u",
        pendingCfdi: null,
        vinculos: v,
      });
      expect(payload.embarque_id).toBe("E-1");
    });
  });

  describe("mapCfdiToValues", () => {
    const baseCfdi = {
      moneda: "MXN",
      serie: "A",
      folio: "100",
      uuid: "abcdef12-3456-7890-abcd-ef1234567890",
      fecha: "2026-03-10",
      tipo_cambio: 1,
      subtotal: 1000,
      iva_trasladado: 160,
      retenciones: 0,
    };
    const baseAi = { categoria_id: "cat-1", notas: "ai notes" };

    it("combina serie-folio cuando ambos existen", () => {
      const v = mapCfdiToValues({ cfdi: baseCfdi, ai: baseAi }, "p1", "Acme");
      expect(v.folio).toBe("A-100");
      expect(v.provId).toBe("p1");
      expect(v.provNombre).toBe("Acme");
      expect(v.subtotal).toBe("1000");
      expect(v.categoriaId).toBe("cat-1");
    });
    it("usa primeros 8 chars del uuid si no hay serie/folio", () => {
      const v = mapCfdiToValues(
        { cfdi: { ...baseCfdi, serie: null, folio: null }, ai: baseAi },
        "p",
        "n",
      );
      expect(v.folio).toBe("abcdef12");
    });
    it("normaliza moneda no soportada a MXN y tc vacío", () => {
      const v = mapCfdiToValues(
        { cfdi: { ...baseCfdi, moneda: "EUR-x" }, ai: baseAi },
        "p",
        "n",
      );
      expect(v.moneda).toBe("MXN");
      expect(v.tc).toBe("");
    });
    it("conserva USD con tc string", () => {
      const v = mapCfdiToValues(
        { cfdi: { ...baseCfdi, moneda: "USD", tipo_cambio: 18.7 }, ai: baseAi },
        "p",
        "n",
      );
      expect(v.moneda).toBe("USD");
      expect(v.tc).toBe("18.7");
    });
    it("usa today si fecha es vacía", () => {
      const v = mapCfdiToValues(
        { cfdi: { ...baseCfdi, fecha: "" }, ai: baseAi },
        "p",
        "n",
      );
      expect(v.emision).toBe("2026-06-15");
      expect(v.vencimiento).toBe("2026-07-15");
    });
    it("ai.notas null se traduce a string vacío", () => {
      const v = mapCfdiToValues(
        { cfdi: baseCfdi, ai: { categoria_id: null, notas: null } },
        "p",
        "n",
      );
      expect(v.notas).toBe("");
      expect(v.categoriaId).toBe("");
    });
  });
});
