import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CLIENTE_PRINCIPAL_ID,
  fetchContactosClienteConEmail,
  fetchHistorialEnviosCotizacion,
} from "@/features/cotizacion/services/envios";
import { fetchContactosClienteEnvio } from "@/features/facturacion/services/contactosClienteEnvio";

type Row = Record<string, unknown>;
type Table = "clientes" | "contactos_cliente" | "cotizacion_envios";
type Result = { data: Row[] | Row | null; error: Error | null };

const db = vi.hoisted(() => ({
  rows: new Map<Table, Row[]>(),
  errors: new Map<Table, Error>(),
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));

// Apply each builder's own filters and projection to real fixture rows.
// A deleted fixture stays visible unless that specific query excludes it.
function makeReadBuilder(table: Table) {
  const filters: Array<(row: Row) => boolean> = [];
  let fields: string[] = [];
  let ordering: { column: string; ascending: boolean } | undefined;
  const result = (single = false): Result => {
    const error = db.errors.get(table) ?? null;
    if (error) return { data: null, error };
    let rows = (db.rows.get(table) ?? []).filter((row) => filters.every((test) => test(row)));
    if (ordering) {
      const { column, ascending } = ordering;
      rows = [...rows].sort((a, b) => String(a[column]).localeCompare(String(b[column])) * (ascending ? 1 : -1));
    }
    rows = rows.map((row) => Object.fromEntries(fields.map((field) => [field, row[field]])));
    if (single && rows.length > 1) throw new Error(`Unexpected multiple rows in ${table}`);
    return { data: single ? rows[0] ?? null : rows, error: null };
  };
  const builder = {
    select(columns: string) {
      fields = columns.split(",").map((column) => column.trim());
      return builder;
    },
    eq(column: string, value: unknown) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    is(column: string, value: null) {
      filters.push((row) => row[column] === value);
      return builder;
    },
    not(column: string, operator: string, value: null) {
      if (operator !== "is") throw new Error(`Unsupported operator: ${operator}`);
      filters.push((row) => row[column] !== value);
      return builder;
    },
    order(column: string, options: { ascending: boolean }) {
      ordering = { column, ascending: options.ascending };
      return builder;
    },
    maybeSingle: () => Promise.resolve(result(true)),
    then: (resolve: (value: Result) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return builder;
}

const cliente = (overrides: Row = {}): Row => ({
  id: "cliente-1", nombre: "Cliente vivo", email: "principal@example.test", deleted_at: null, ...overrides,
});
const contacto = (overrides: Row = {}): Row => ({
  id: "contacto-1", cliente_id: "cliente-1", nombre: "Contacto vivo", contacto: "Compras",
  email: "contacto@example.test", tipo: "Operativo", created_at: "2026-10-01", deleted_at: null, ...overrides,
});

beforeEach(() => {
  db.rows.clear();
  db.errors.clear();
  db.from.mockReset().mockImplementation(makeReadBuilder);
  db.rows.set("clientes", [cliente(), cliente({ id: "otro-cliente", email: "otro@example.test" })]);
  db.rows.set("contactos_cliente", []);
});

describe("cotización: email principal sólo de un cliente vigente", () => {
  it.each([
    ["eliminado", [cliente({ deleted_at: "2026-10-12" })]],
    ["ausente", []],
    ["otro ID", [cliente({ id: "otro-cliente" })]],
  ])("no fabrica __cliente_principal__ para cliente %s", async (_name, rows) => {
    db.rows.set("clientes", rows);
    expect(await fetchContactosClienteConEmail("cliente-1")).toEqual([]);
  });

  it("conserva el principal vivo, trim y deduplicación sin distinguir mayúsculas", async () => {
    db.rows.set("clientes", [cliente({ email: " Principal@Example.test " })]);
    db.rows.set("contactos_cliente", [
      contacto({ id: "duplicado", email: "principal@example.test" }),
      contacto({ id: "otro", email: "otro@example.test" }),
      contacto({ id: "otro-duplicado", email: "otro@example.test" }),
      contacto({ id: "eliminado", deleted_at: "2026-10-12" }),
      contacto({ id: "ajeno", cliente_id: "otro-cliente" }),
      contacto({ id: "invalido", email: "sin-arroba" }),
    ]);
    const result = await fetchContactosClienteConEmail("cliente-1");
    expect(result).toEqual([
      { id: CLIENTE_PRINCIPAL_ID, nombre: "Cliente vivo", contacto: "Cliente vivo", email: "Principal@Example.test", tipo: "Cliente" },
      { id: "otro", nombre: "Contacto vivo", contacto: "Compras", email: "otro@example.test", tipo: "Operativo" },
      { id: "otro-duplicado", nombre: "Contacto vivo", contacto: "Compras", email: "otro@example.test", tipo: "Operativo" },
    ]);
  });

  it.each([null, "", "sin-arroba", "bad@example"])("conserva la validación del principal %s", async (email) => {
    db.rows.set("clientes", [cliente({ email })]);
    db.rows.set("contactos_cliente", [contacto()]);
    expect((await fetchContactosClienteConEmail("cliente-1")).map((row) => row.id)).toEqual(["contacto-1"]);
  });

  it.each([
    ["eliminado", [cliente({ deleted_at: "2026-10-12" })]],
    ["ausente", []],
  ])("preserva contactos vivos independientes de cliente %s", async (_name, rows) => {
    db.rows.set("clientes", rows);
    db.rows.set("contactos_cliente", [
      contacto({ email: "principal@example.test" }),
      contacto({ id: "eliminado", deleted_at: "2026-10-12" }),
    ]);
    const result = await fetchContactosClienteConEmail("cliente-1");
    expect(result.map((row) => [row.id, row.email])).toEqual([["contacto-1", "principal@example.test"]]);
    expect(result.some((row) => row.id === CLIENTE_PRINCIPAL_ID)).toBe(false);
  });

  it.each<Table>(["clientes", "contactos_cliente"])("propaga el error de %s", async (table) => {
    const error = new Error(`Error de ${table}`);
    db.errors.set(table, error);
    await expect(fetchContactosClienteConEmail("cliente-1")).rejects.toBe(error);
  });

  it("conserva prioridad del error de contactos cuando fallan ambas lecturas", async () => {
    const error = new Error("Error de contactos");
    db.errors.set("contactos_cliente", error);
    db.errors.set("clientes", new Error("Error de cliente"));
    await expect(fetchContactosClienteConEmail("cliente-1")).rejects.toBe(error);
  });

  it("mantiene destinatarios y datos históricos aunque el cliente esté eliminado", async () => {
    db.rows.set("clientes", [cliente({ deleted_at: "2026-10-12" })]);
    const old = { id: "envio-1", cotizacion_id: "cotizacion-1", created_at: "2026-10-01", destinatarios: [{ email: "manual@example.test", nombre: "Manual" }], cc: ["copia@example.test"] };
    const recent = { ...old, id: "envio-2", created_at: "2026-10-02" };
    db.rows.set("cotizacion_envios", [old, recent, { ...old, id: "ajeno", cotizacion_id: "otra" }]);
    const result = await fetchHistorialEnviosCotizacion("cotizacion-1");
    expect(result.map((row) => row.id)).toEqual(["envio-2", "envio-1"]);
    expect(result.map((row) => row.destinatarios)).toEqual([recent.destinatarios, old.destinatarios]);
    expect(result.map((row) => row.cc)).toEqual([recent.cc, old.cc]);
    expect(db.from).toHaveBeenCalledExactlyOnceWith("cotizacion_envios");
  });

  it("propaga errores históricos sin consultar clientes", async () => {
    const error = new Error("Error de historial");
    db.errors.set("cotizacion_envios", error);
    await expect(fetchHistorialEnviosCotizacion("cotizacion-1")).rejects.toBe(error);
    expect(db.from).toHaveBeenCalledExactlyOnceWith("cotizacion_envios");
  });
});

describe("facturación: sugerencias sin email directo de cliente eliminado", () => {
  it.each([
    ["eliminado", [cliente({ deleted_at: "2026-10-12" })]],
    ["ausente", []],
    ["otro ID", [cliente({ id: "otro-cliente" })]],
  ])("cliente %s no devuelve emailCliente ni fallback emailSugerido", async (_name, rows) => {
    db.rows.set("clientes", rows);
    expect(await fetchContactosClienteEnvio("cliente-1")).toEqual({ contactos: [], emailCliente: null, emailSugerido: null });
  });

  it("prioriza el contacto de facturación sobre el email de cliente vivo", async () => {
    db.rows.set("contactos_cliente", [
      contacto({ id: "exportador", tipo: "Exportador", email: "exportador@example.test", created_at: "2026-10-12" }),
      contacto({ id: "facturacion", tipo: "  FACTURACIÓN  ", email: "facturacion@example.test", created_at: "2026-10-01" }),
      contacto({ id: "facturacion-reciente", tipo: "Cobranza", email: "reciente@example.test", created_at: "2026-10-05" }),
      contacto({ id: "eliminado", tipo: "Cobranza", deleted_at: "2026-10-12", created_at: "2026-10-13" }),
      contacto({ id: "ajeno", tipo: "Cobranza", cliente_id: "otro-cliente", created_at: "2026-10-13" }),
      contacto({ id: "sin-email", tipo: "Cobranza", email: null }),
      contacto({ id: "invalido", tipo: "Cobranza", email: "sin-arroba" }),
    ]);
    const result = await fetchContactosClienteEnvio("cliente-1");
    expect(result.emailCliente).toBe("principal@example.test");
    expect(result.emailSugerido).toBe("reciente@example.test");
    expect(result.contactos.map((row) => [row.id, row.esFacturacion])).toEqual([
      ["facturacion-reciente", true], ["facturacion", true], ["exportador", false],
    ]);
  });

  it("prioriza el principal vivo sobre contactos de otros tipos", async () => {
    db.rows.set("contactos_cliente", [contacto({ tipo: "Exportador" })]);
    expect(await fetchContactosClienteEnvio("cliente-1")).toMatchObject({
      emailCliente: "principal@example.test", emailSugerido: "principal@example.test",
    });
  });

  it.each([null, ""])("no modifica normalización ni fallback existente con email %s", async (email) => {
    db.rows.set("clientes", [cliente({ email })]);
    db.rows.set("contactos_cliente", [contacto()]);
    expect(await fetchContactosClienteEnvio("cliente-1")).toMatchObject({
      emailCliente: email, emailSugerido: email ?? "contacto@example.test",
    });
  });

  it.each([
    ["eliminado", [cliente({ deleted_at: "2026-10-12" })]],
    ["ausente", []],
  ])("mantiene sugerencias de contactos vivos para cliente %s", async (_name, rows) => {
    db.rows.set("clientes", rows);
    db.rows.set("contactos_cliente", [
      contacto({ id: "operativo", email: "operativo@example.test", created_at: "2026-10-12" }),
      contacto({ id: "cobranza", email: "principal@example.test", tipo: "Cobranza", created_at: "2026-10-01" }),
    ]);
    const result = await fetchContactosClienteEnvio("cliente-1");
    expect(result.emailCliente).toBeNull();
    expect(result.emailSugerido).toBe("principal@example.test");
    expect(result.contactos.map((row) => row.id)).toEqual(["cobranza", "operativo"]);
  });

  it("usa el contacto vivo más reciente como fallback sin principal ni contacto fiscal", async () => {
    db.rows.set("clientes", [cliente({ deleted_at: "2026-10-12" })]);
    db.rows.set("contactos_cliente", [
      contacto({ id: "viejo", email: "viejo@example.test", created_at: "2026-10-01" }),
      contacto({ id: "reciente", email: "reciente@example.test", created_at: "2026-10-12" }),
    ]);
    expect(await fetchContactosClienteEnvio("cliente-1")).toMatchObject({ emailCliente: null, emailSugerido: "reciente@example.test" });
  });

  it("no añade deduplicación entre contactos ni contra el principal", async () => {
    db.rows.set("contactos_cliente", [
      contacto({ id: "primero", email: "principal@example.test" }),
      contacto({ id: "segundo", email: "principal@example.test" }),
    ]);
    const result = await fetchContactosClienteEnvio("cliente-1");
    expect(result.contactos.map((row) => row.id)).toEqual(["primero", "segundo"]);
    expect(result.emailCliente).toBe("principal@example.test");
  });

  it("conserva fallback a contactos cuando la lectura del cliente devuelve error", async () => {
    db.errors.set("clientes", new Error("Error de cliente"));
    db.rows.set("contactos_cliente", [contacto()]);
    expect(await fetchContactosClienteEnvio("cliente-1")).toMatchObject({ emailCliente: null, emailSugerido: "contacto@example.test" });
  });

  it("conserva fallback al principal cuando la lectura de contactos devuelve error", async () => {
    db.errors.set("contactos_cliente", new Error("Error de contactos"));
    expect(await fetchContactosClienteEnvio("cliente-1")).toEqual({ contactos: [], emailCliente: "principal@example.test", emailSugerido: "principal@example.test" });
  });

  it("conserva resultado vacío si ambas lecturas devuelven error", async () => {
    db.errors.set("clientes", new Error("Error de cliente"));
    db.errors.set("contactos_cliente", new Error("Error de contactos"));
    expect(await fetchContactosClienteEnvio("cliente-1")).toEqual({ contactos: [], emailCliente: null, emailSugerido: null });
  });
});
