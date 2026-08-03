import { describe, it, expect } from "vitest";
import { getErrorMessage } from "@/lib/errors";

describe("getErrorMessage · errores crudos de Postgres (Q-15.3)", () => {
  it("traduce RLS por mensaje de texto (row-level security policy)", () => {
    const err = {
      message: 'new row violates row-level security policy for table "facturas"',
    };
    const msg = getErrorMessage(err);
    expect(msg).toMatch(/no tienes permisos/i);
    expect(msg).toMatch(/facturas/i);
    expect(msg).not.toMatch(/row-level security/i);
  });

  it("traduce permission denied (42501) por código", () => {
    const err = { code: "42501", message: "permission denied for table clientes" };
    const msg = getErrorMessage(err);
    expect(msg).toMatch(/no tienes permisos/i);
    expect(msg).not.toMatch(/permission denied/i);
  });

  it("traduce violación de llave foránea (23503)", () => {
    const err = {
      code: "23503",
      message:
        'update or delete on table "clientes" violates foreign key constraint "cotizaciones_cliente_id_fkey" on table "cotizaciones"',
    };
    const msg = getErrorMessage(err);
    expect(msg).toMatch(/relacionado con otros datos/i);
    expect(msg).not.toMatch(/foreign key/i);
  });

  it("traduce violación de unicidad (23505)", () => {
    const err = {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "clientes_rfc_key"',
    };
    const msg = getErrorMessage(err);
    // FIX 6 (P3): mensaje específico de negocio, sin el nombre del índice.
    expect(msg).toMatch(/ya existe un cliente con ese rfc/i);
    expect(msg).not.toMatch(/duplicate key/i);
    expect(msg).not.toMatch(/clientes_rfc_key/i);
  });

  it("FIX 6 (P3) — folio duplicado de factura de proveedor tiene mensaje propio", () => {
    const msg = getErrorMessage({
      code: "23505",
      message:
        'duplicate key value violates unique constraint "proveedor_facturas_org_prov_folio_uq"',
    });
    expect(msg).toMatch(/factura de este proveedor con ese folio/i);
    expect(msg).not.toMatch(/proveedor_facturas_org_prov_folio_uq/i);
  });

  it("traduce violación de check constraint (23514)", () => {
    const err = {
      code: "23514",
      message: 'new row for relation "embarques" violates check constraint "embarques_estado_check"',
    };
    const msg = getErrorMessage(err);
    expect(msg).toMatch(/no cumplen una regla de validación/i);
    expect(msg).not.toMatch(/check constraint/i);
  });

  it("no altera mensajes que no coinciden con ningún patrón conocido", () => {
    const err = { code: "08000", message: "connection exception" };
    expect(getErrorMessage(err)).toMatch(/connection exception/i);
  });
});
