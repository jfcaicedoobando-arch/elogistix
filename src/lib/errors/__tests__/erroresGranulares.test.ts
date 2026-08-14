import { describe, expect, it } from "vitest";
import { translatePostgresError } from "@/lib/errors/pgErrorCodes";
import { mensajeConstraintUnico } from "@/lib/errors/pgConstraintMessages";
import { buscarCodigoSat, extraerCodigoSatDeTexto } from "@/lib/errors/satErrorCodes";
import { interpretarErrorFacturapi, traducirMensajeSat } from "@/lib/errors/facturapiError";
import { getErrorMessage } from "@/lib/errors";

describe("translatePostgresError · SQLSTATE nuevos", () => {
  it("23502 nombra el campo faltante", () => {
    const msg = translatePostgresError('null value in column "fecha_pago" violates not-null', "23502");
    expect(msg).toContain("la fecha de pago");
  });

  it("22001 avisa texto demasiado largo", () => {
    expect(translatePostgresError('value too long for type character varying(20)', "22001"))
      .toContain("demasiado largo");
  });

  it("22P02 y 22003 hablan de formato y límite", () => {
    expect(translatePostgresError("invalid input syntax for type uuid", "22P02")).toContain("formato inválido");
    expect(translatePostgresError("numeric field overflow", "22003")).toContain("excede el límite");
  });

  it("40001, 40P01 y 57014 hablan de concurrencia y tiempo", () => {
    expect(translatePostgresError("could not serialize access", "40001")).toContain("al mismo tiempo");
    expect(translatePostgresError("deadlock detected", "40P01")).toContain("bloquearon");
    expect(translatePostgresError("canceling statement due to statement timeout", "57014"))
      .toContain("tardó demasiado");
  });

  it("23P01 avisa traslape de periodo", () => {
    expect(translatePostgresError("conflicting key value violates exclusion constraint", "23P01"))
      .toContain("traslapa");
  });

  it("P0001 conserva el mensaje del RAISE pero deja pasar los LC_*", () => {
    expect(translatePostgresError("El embarque ya está cerrado.", "P0001")).toBe("El embarque ya está cerrado.");
    expect(translatePostgresError("LC_ORG_SIN_CONTEXTO", "P0001")).toBeNull();
  });

  it("mantiene los casos previos (RLS, FK, unicidad, check)", () => {
    expect(translatePostgresError('permission denied for table "facturas"', "42501")).toContain("No tienes permisos");
    expect(translatePostgresError("violates foreign key constraint", "23503")).toContain("relacionado");
    expect(translatePostgresError("duplicate key value violates unique constraint", "23505")).toContain("Ya existe");
    expect(translatePostgresError("violates check constraint", "23514")).toContain("regla de validación");
  });

  it("devuelve null para errores desconocidos", () => {
    expect(translatePostgresError("boom", null)).toBeNull();
  });
});

describe("mensajes por constraint", () => {
  it("folio duplicado de proveedor", () => {
    expect(mensajeConstraintUnico("proveedor_facturas_org_prov_folio")).toContain("folio");
  });

  it("RFC de cliente y de proveedor", () => {
    expect(mensajeConstraintUnico("clientes_rfc_key")).toContain("cliente");
    expect(mensajeConstraintUnico("proveedores_rfc_key")).toContain("proveedor");
  });

  it("refacturación abierta y contacto principal", () => {
    expect(mensajeConstraintUnico("refacturaciones_una_abierta")).toContain("refacturación");
    expect(mensajeConstraintUnico("proveedor_contacto_principal_unico")).toContain("contacto principal");
  });

  it("constraint sin mensaje propio devuelve null", () => {
    expect(mensajeConstraintUnico("tabla_x_idx")).toBeNull();
  });
});

describe("catálogo SAT", () => {
  it("traduce 301 y 402", () => {
    expect(buscarCodigoSat("301")?.titulo).toContain("XML");
    expect(buscarCodigoSat("402")?.titulo).toContain("padrón");
  });

  it("traduce códigos de FacturApi", () => {
    expect(buscarCodigoSat("invalid_customer_tax_id")?.titulo).toContain("RFC");
  });

  it("extrae el código de un texto libre", () => {
    expect(extraerCodigoSatDeTexto("El SAT respondió 402: RFC no inscrito")).toBe("402");
    expect(extraerCodigoSatDeTexto("CFDI40147 impuestos")).toBe("CFDI40147");
    expect(extraerCodigoSatDeTexto("total 999")).toBeNull();
  });

  it("código desconocido devuelve null", () => {
    expect(buscarCodigoSat("999999")).toBeNull();
    expect(buscarCodigoSat(undefined)).toBeNull();
  });
});

describe("interpretarErrorFacturapi", () => {
  it("rechazo 301 con logId", () => {
    const out = interpretarErrorFacturapi({
      status: 400,
      detail: { code: "301", message: "XML mal formado", logId: "log_123", path: "items[0]" },
    });
    expect(out?.titulo).toContain("XML");
    expect(out?.detalles.logId).toBe("log_123");
    expect(out?.detalles.campo).toBe("items[0]");
  });

  it("rechazo 402 con errores[]", () => {
    const out = interpretarErrorFacturapi({
      status: 400,
      detail: { code: "402", message: "RFC", errors: [{ path: "customer.tax_id", message: "no inscrito" }] },
    });
    expect(out?.codigo).toBe("402");
    expect(out?.descripcion).toContain("customer.tax_id: no inscrito");
  });

  it("código desconocido cae al fallback conservando el mensaje", () => {
    const out = interpretarErrorFacturapi({ detail: { message: "Algo raro pasó" } });
    expect(out?.titulo).toContain("servicio de facturación");
    expect(out?.descripcion).toBe("Algo raro pasó");
  });

  it("body ajeno devuelve null", () => {
    expect(interpretarErrorFacturapi({})).toBeNull();
    expect(interpretarErrorFacturapi(null)).toBeNull();
  });
});

describe("pipeline central", () => {
  it("getErrorMessage traduce un rechazo SAT en texto libre", () => {
    expect(getErrorMessage(new Error("FacturApi respondió 402"))).toContain("padrón");
  });

  it("getErrorMessage traduce un 23502 de PostgREST", () => {
    expect(getErrorMessage({ message: 'null value in column "monto"', code: "23502" }))
      .toContain("el monto");
  });

  it("traducirMensajeSat devuelve null si no hay código", () => {
    expect(traducirMensajeSat("error genérico")).toBeNull();
  });
});
