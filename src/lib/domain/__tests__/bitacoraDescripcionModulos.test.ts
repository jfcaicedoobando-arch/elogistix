import { describe, it, expect } from "vitest";
import {
  describirFacturacion,
  describirCxp,
  describirCosteo,
} from "../bitacoraDescripcionModulos";

describe("describirFacturacion", () => {
  it("facturapi_emitida con uuid arma contexto truncado", () => {
    const out = describirFacturacion("facturapi_emitida", { uuid: "12345678-abcd" });
    expect(out?.titulo).toBe("Timbró factura");
    expect(out?.contexto).toBe("UUID 12345678…");
  });

  it("facturapi_emitida sin uuid deja contexto undefined", () => {
    const out = describirFacturacion("facturapi_emitida", {});
    expect(out?.contexto).toBeUndefined();
  });

  it("factura.borrador_generado", () => {
    expect(describirFacturacion("factura.borrador_generado", {})?.titulo).toBe("Generó borrador de factura");
  });

  it("factura.borrador_eliminado", () => {
    expect(describirFacturacion("factura.borrador_eliminado", {})?.titulo).toBe("Eliminó borrador de factura");
  });

  it("factura_duplicada_para_sustitucion", () => {
    expect(describirFacturacion("factura_duplicada_para_sustitucion", {})?.titulo).toBe("Generó borrador de sustitución");
  });

  it("facturapi_cancelacion_solicitada con motivo string", () => {
    const out = describirFacturacion("facturapi_cancelacion_solicitada", { motivo: "duplicado" });
    expect(out?.contexto).toBe("duplicado");
  });

  it("facturapi_cancelacion_solicitada sin motivo válido", () => {
    const out = describirFacturacion("facturapi_cancelacion_solicitada", { motivo: 123 });
    expect(out?.contexto).toBeUndefined();
  });

  it("facturapi_consulta_reconciliada", () => {
    expect(describirFacturacion("facturapi_consulta_reconciliada", {})?.titulo).toBe("Reconciliación con FacturApi");
  });

  it("facturapi_cancelada", () => {
    expect(describirFacturacion("facturapi_cancelada", {})?.titulo).toBe("Canceló factura");
  });

  it("facturapi_cancelar_failed", () => {
    expect(describirFacturacion("facturapi_cancelar_failed", {})?.titulo).toBe("Falló cancelación de factura");
  });

  it("facturapi_sustituida", () => {
    expect(describirFacturacion("facturapi_sustituida", {})?.titulo).toBe("Sustituyó factura");
  });

  it("facturapi_nc_emitida", () => {
    expect(describirFacturacion("facturapi_nc_emitida", {})?.titulo).toBe("Emitió nota de crédito");
  });

  it("facturapi_nc_cancelada", () => {
    expect(describirFacturacion("facturapi_nc_cancelada", {})?.titulo).toBe("Canceló nota de crédito");
  });

  it("facturapi_rep_emitido", () => {
    expect(describirFacturacion("facturapi_rep_emitido", {})?.titulo).toBe("Timbró complemento de pago");
  });

  it("facturapi_rep_cancelado", () => {
    expect(describirFacturacion("facturapi_rep_cancelado", {})?.titulo).toBe("Canceló complemento de pago");
  });

  it("cfdi_enviado con email string", () => {
    const out = describirFacturacion("cfdi_enviado", { email: "a@b.com" });
    expect(out?.contexto).toBe("a@b.com");
  });

  it("cfdi_enviado sin email válido", () => {
    const out = describirFacturacion("cfdi_enviado", { email: "" });
    expect(out?.contexto).toBeUndefined();
  });

  it("cfdi_envio_failed", () => {
    expect(describirFacturacion("cfdi_envio_failed", {})?.titulo).toBe("Falló envío de CFDI");
  });

  it("facturapi_emitir_failed", () => {
    expect(describirFacturacion("facturapi_emitir_failed", {})?.titulo).toBe("Falló timbrado de factura");
  });

  it("acción desconocida devuelve null", () => {
    expect(describirFacturacion("accion_inexistente", {})).toBeNull();
  });
});

describe("describirCxp", () => {
  it("pagar con monto numérico usa moneda por defecto MXN", () => {
    const out = describirCxp("pagar", { monto: 100 });
    expect(out?.titulo).toBe("Registró pago a proveedor");
    expect(out?.contexto).toContain("100");
  });

  it("pagar con moneda explícita", () => {
    const out = describirCxp("pagar", { monto: 50, moneda: "USD" });
    expect(out?.contexto).toContain("50");
  });

  it("pagar sin monto numérico deja contexto undefined", () => {
    const out = describirCxp("pagar", {});
    expect(out?.contexto).toBeUndefined();
  });

  it("pagar con monto NaN se descarta", () => {
    const out = describirCxp("pagar", { monto: Number.NaN });
    expect(out?.contexto).toBeUndefined();
  });

  it("cancelar con motivo", () => {
    const out = describirCxp("cancelar", { motivo: "error captura" });
    expect(out?.titulo).toBe("Canceló factura de proveedor");
    expect(out?.contexto).toBe("error captura");
  });

  it("cancelar sin motivo", () => {
    const out = describirCxp("cancelar", {});
    expect(out?.contexto).toBeUndefined();
  });

  it("eliminar_pago", () => {
    expect(describirCxp("eliminar_pago", {})?.titulo).toBe("Eliminó pago a proveedor");
  });

  it("crear_nota_credito", () => {
    expect(describirCxp("crear_nota_credito", {})?.titulo).toBe("Registró nota de crédito de proveedor");
  });

  it("aplicar_nota_credito", () => {
    expect(describirCxp("aplicar_nota_credito", {})?.titulo).toBe("Aplicó nota de crédito");
  });

  it("cancelar_nota_credito", () => {
    expect(describirCxp("cancelar_nota_credito", {})?.titulo).toBe("Canceló nota de crédito");
  });

  it("acción desconocida devuelve null", () => {
    expect(describirCxp("otra_accion", {})).toBeNull();
  });
});

describe("describirCosteo", () => {
  it("crear con nombre de entidad", () => {
    const out = describirCosteo("crear", "Tarifa flete");
    expect(out?.titulo).toBe("Creó tarifa");
    expect(out?.contexto).toBe("Tarifa flete");
  });

  it("crear sin nombre de entidad usa undefined", () => {
    const out = describirCosteo("crear", null);
    expect(out?.contexto).toBeUndefined();
  });

  it("crear con nombre vacío usa undefined (string falsy)", () => {
    const out = describirCosteo("crear", "");
    expect(out?.contexto).toBeUndefined();
  });

  it("crear sin segundo argumento", () => {
    const out = describirCosteo("crear");
    expect(out?.contexto).toBeUndefined();
  });

  it("editar", () => {
    expect(describirCosteo("editar")?.titulo).toBe("Editó tarifa");
  });

  it("eliminar", () => {
    expect(describirCosteo("eliminar")?.titulo).toBe("Eliminó tarifa");
  });

  it("reemplazar", () => {
    expect(describirCosteo("reemplazar")?.titulo).toBe("Marcó tarifa como reemplazada");
  });

  it("acción desconocida devuelve null", () => {
    expect(describirCosteo("desconocida")).toBeNull();
  });
});
