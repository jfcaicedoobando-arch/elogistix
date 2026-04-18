import { describe, it, expect } from "vitest";
import {
  buildEmbarquePayload,
  buildConceptosVentaPayload,
  buildConceptosCostoPayload,
  buildVincularCotizacionUpdates,
  buildDesvincularCotizacionUpdates,
  DEFAULT_EMBARQUE_VALUES,
  type EmbarqueFormValues,
  type CotizacionParaVincular,
} from "@/lib/mappers/embarque";

const baseValues = (over: Partial<EmbarqueFormValues> = {}): EmbarqueFormValues => ({
  ...DEFAULT_EMBARQUE_VALUES,
  modo: "Marítimo",
  tipo: "Importación",
  clienteId: "cli-1",
  descripcionMercancia: "Repuestos",
  pesoKg: "1500",
  volumenM3: "10",
  piezas: "20",
  ...over,
});

describe("embarqueMappers", () => {
  describe("buildEmbarquePayload", () => {
    it("convierte strings numéricos a números", () => {
      const payload = buildEmbarquePayload(baseValues(), [], "Cliente Test", "op@test.mx");
      expect(payload.peso_kg).toBe(1500);
      expect(payload.volumen_m3).toBe(10);
      expect(payload.piezas).toBe(20);
      expect(payload.tipo_cambio_usd).toBe(17.25);
    });

    it("convierte strings vacíos a null en campos opcionales", () => {
      const payload = buildEmbarquePayload(baseValues(), [], "Cliente", "op");
      expect(payload.naviera).toBeNull();
      expect(payload.bl_master).toBeNull();
      expect(payload.contenedor).toBeNull();
      expect(payload.etd).toBeNull();
    });

    it("usa cliente_nombre cuando consignatario es __cliente__", () => {
      const v = baseValues({ consignatario: "__cliente__" });
      const payload = buildEmbarquePayload(v, [], "Mi Cliente", "op");
      expect(payload.consignatario).toBe("Mi Cliente");
    });

    it("incluye operador y tipo_carga", () => {
      const payload = buildEmbarquePayload(baseValues({ tipoCarga: "Mercancía Peligrosa" }), [], "C", "op@x.mx");
      expect(payload.operador).toBe("op@x.mx");
      expect(payload.tipo_carga).toBe("Mercancía Peligrosa");
    });
  });

  describe("buildConceptosVentaPayload", () => {
    it("filtra conceptos sin descripción", () => {
      const result = buildConceptosVentaPayload([
        { id: 1, concepto: "", cantidad: 1, precioUnitario: 100, moneda: "USD" },
        { id: 2, concepto: "Flete", cantidad: 2, precioUnitario: 500, moneda: "USD" },
      ]);
      expect(result).toHaveLength(1);
      expect(result[0].descripcion).toBe("Flete");
    });

    it("calcula total como cantidad × precio_unitario", () => {
      const result = buildConceptosVentaPayload([
        { id: 1, concepto: "X", cantidad: 3, precioUnitario: 250, moneda: "USD" },
      ]);
      expect(result[0].total).toBe(750);
    });
  });

  describe("buildConceptosCostoPayload", () => {
    it("resuelve nombre del proveedor desde el catálogo", () => {
      const result = buildConceptosCostoPayload(
        [{ id: 1, proveedorId: "p-1", concepto: "Flete", monto: 1000, moneda: "USD" }],
        [{ id: "p-1", nombre: "Maersk" }, { id: "p-2", nombre: "Otro" }],
      );
      expect(result[0].proveedor_nombre).toBe("Maersk");
      expect(result[0].proveedor_id).toBe("p-1");
    });

    it("retorna proveedor_nombre vacío si no se encuentra", () => {
      const result = buildConceptosCostoPayload(
        [{ id: 1, proveedorId: "ghost", concepto: "X", monto: 100, moneda: "USD" }],
        [],
      );
      expect(result[0].proveedor_nombre).toBe("");
    });

    it("retorna proveedor_id null cuando está vacío", () => {
      const result = buildConceptosCostoPayload(
        [{ id: 1, proveedorId: "", concepto: "X", monto: 100, moneda: "USD" }],
        [],
      );
      expect(result[0].proveedor_id).toBeNull();
    });

    it("filtra costos sin concepto", () => {
      const result = buildConceptosCostoPayload(
        [{ id: 1, proveedorId: "p", concepto: "", monto: 100, moneda: "USD" }],
        [],
      );
      expect(result).toHaveLength(0);
    });
  });

  describe("buildVincularCotizacionUpdates", () => {
    const cot: CotizacionParaVincular = {
      cliente_id: "cli-99",
      modo: "Aéreo",
      tipo: "Exportación",
      incoterm: "CIF",
      descripcion_mercancia: "Electrónica",
      tipo_carga: "Carga General",
      tipo_contenedor: "40HC",
      peso_kg: 500,
      volumen_m3: 5,
      piezas: 10,
      origen: "MEX",
      destino: "MIA",
    };

    it("incluye todos los campos esperados", () => {
      const updates = buildVincularCotizacionUpdates(cot);
      const map = Object.fromEntries(updates);
      expect(map.modo).toBe("Aéreo");
      expect(map.incoterm).toBe("CIF");
      expect(map.puertoOrigen).toBe("MEX");
      expect(map.puertoDestino).toBe("MIA");
    });

    it("convierte números a strings", () => {
      const map = Object.fromEntries(buildVincularCotizacionUpdates(cot));
      expect(map.pesoKg).toBe("500");
      expect(map.piezas).toBe("10");
    });

    it("usa string vacío para cliente_id null", () => {
      const map = Object.fromEntries(buildVincularCotizacionUpdates({ ...cot, cliente_id: null }));
      expect(map.clienteId).toBe("");
    });

    it("usa default 'Carga General' si tipo_carga vacío", () => {
      const map = Object.fromEntries(buildVincularCotizacionUpdates({ ...cot, tipo_carga: "" }));
      expect(map.tipoCarga).toBe("Carga General");
    });
  });

  describe("buildDesvincularCotizacionUpdates", () => {
    it("limpia todos los campos vinculables", () => {
      const map = Object.fromEntries(buildDesvincularCotizacionUpdates());
      expect(map.clienteId).toBe("");
      expect(map.modo).toBe("");
      expect(map.descripcionMercancia).toBe("");
      expect(map.puertoOrigen).toBe("");
    });

    it("restaura valores por defecto (incoterm FOB, tipoCarga General)", () => {
      const map = Object.fromEntries(buildDesvincularCotizacionUpdates());
      expect(map.incoterm).toBe("FOB");
      expect(map.tipoCarga).toBe("Carga General");
    });
  });
});
