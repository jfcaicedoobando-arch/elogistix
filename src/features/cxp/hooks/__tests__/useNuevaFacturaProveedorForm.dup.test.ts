/**
 * Tests de la detección de CFDI duplicado en la captura de facturas de
 * proveedor (v13.343.0).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const buscar = vi.hoisted(() => vi.fn());
vi.mock("@/features/cxp/services", () => ({ buscarFacturaPorUuidFiscalResultado: buscar }));

import {
  detectarCfdiDuplicado,
  buscarCfdiDuplicado,
  describirFacturaExistente,
} from "../useNuevaFacturaProveedorForm.dup";

const EXISTENTE = {
  id: "f-1",
  folio_interno: "FP-000123",
  folio_proveedor: "9593",
  proveedor_nombre: "ADMINISTRACION GONG",
  estado: "Vigente",
  estado_aprobacion: "aprobada",
};

describe("detectarCfdiDuplicado", () => {
  beforeEach(() => buscar.mockReset());

  it("devuelve la factura existente", async () => {
    buscar.mockResolvedValue({ estado: "existe", factura: EXISTENTE });
    expect(await detectarCfdiDuplicado("uuid-1")).toEqual(EXISTENTE);
  });

  it("no consulta si no hay UUID", async () => {
    expect(await detectarCfdiDuplicado(null)).toBeNull();
    expect(buscar).not.toHaveBeenCalled();
  });

  it("devuelve null cuando la búsqueda no encuentra nada", async () => {
    buscar.mockResolvedValue({ estado: "ninguno" });
    expect(await detectarCfdiDuplicado("uuid-1")).toBeNull();
  });

  it("marca estado error cuando la consulta falla (no lo confunde con 'no hay duplicado')", async () => {
    buscar.mockRejectedValue(new Error("network"));
    expect(await buscarCfdiDuplicado("uuid-1")).toEqual({ estado: "error" });
    expect(await detectarCfdiDuplicado("uuid-1")).toBeNull();
  });
});

describe("describirFacturaExistente", () => {
  it("arma folio interno + estado + aprobación", () => {
    expect(describirFacturaExistente(EXISTENTE)).toBe("FP-000123 · Vigente · aprobada");
  });

  it("cae al folio del proveedor cuando no hay folio interno", () => {
    expect(describirFacturaExistente({ ...EXISTENTE, folio_interno: null }))
      .toBe("9593 · Vigente · aprobada");
  });

  it("tolera campos nulos", () => {
    expect(describirFacturaExistente({
      id: "f-2", folio_interno: null, folio_proveedor: null,
      proveedor_nombre: null, estado: null, estado_aprobacion: null,
    })).toBe("sin folio");
  });
});
