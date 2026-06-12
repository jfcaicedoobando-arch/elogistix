import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchProveedoresPaginados,
  fetchProveedoresLite,
  fetchProveedor,
  findProveedorByRfc,
  findProveedorByRfcEnOrg,
  insertProveedor,
  updateProveedor,
  deleteProveedor,
  fetchProveedorOperaciones,
  ProveedorDuplicadoError,
} from "@/services/proveedor";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("services/proveedor", () => {
  it("fetchProveedoresPaginados mapea filas del RPC", async () => {
    mock.setRpcResult("proveedores_listado", {
      data: [
        {
          id: "p1",
          nombre: "Naviera",
          tipo: "naviera",
          rfc: "ABC010101AAA",
          contacto: "Juan",
          moneda_preferida: "USD",
          pais: "MX",
          origen_proveedor: "Nacional",
          categoria: "operativo",
          subtipo_gasto: null,
          total_operaciones: "3",
          monto_pendiente: "1500",
          total_count: "1",
        },
      ],
      error: null,
    });
    const res = await fetchProveedoresPaginados({
      search: "",
      page: 0,
      pageSize: 20,
      organizationId: "org1",
    });
    expect(res.count).toBe(1);
    expect(res.data[0].total_operaciones).toBe(3);
    expect(res.data[0].monto_pendiente).toBe(1500);
  });

  it("fetchProveedoresPaginados devuelve vacío sin filas", async () => {
    mock.setRpcResult("proveedores_listado", { data: [], error: null });
    const res = await fetchProveedoresPaginados({
      search: "x",
      page: 0,
      pageSize: 10,
      organizationId: null,
    });
    expect(res).toEqual({ data: [], count: 0 });
  });

  it("fetchProveedoresPaginados propaga error", async () => {
    mock.setRpcResult("proveedores_listado", { data: null, error: { message: "boom" } });
    await expect(
      fetchProveedoresPaginados({ search: "", page: 0, pageSize: 10, organizationId: null }),
    ).rejects.toBeTruthy();
  });

  it("fetchProveedoresLite devuelve lista", async () => {
    mock.setTableResult("proveedores", {
      data: [{ id: "p1", nombre: "ACME" }],
      error: null,
    });
    const r = await fetchProveedoresLite("org1");
    expect(r).toEqual([{ id: "p1", nombre: "ACME" }]);
  });

  it("fetchProveedor devuelve detalle o null", async () => {
    mock.setTableResult("proveedores", { data: { id: "p1", nombre: "ACME" }, error: null });
    const r = await fetchProveedor("p1");
    expect(r?.nombre).toBe("ACME");
  });

  it("findProveedorByRfc devuelve null si rfc vacío", async () => {
    const r = await findProveedorByRfc("");
    expect(r).toBeNull();
  });

  it("findProveedorByRfc consulta supabase cuando hay rfc", async () => {
    mock.setTableResult("proveedores", { data: { id: "p1", nombre: "ACME" }, error: null });
    const r = await findProveedorByRfc("abc010101aaa");
    expect(r?.id).toBe("p1");
  });

  it("findProveedorByRfcEnOrg ignora RFCs genéricos SAT", async () => {
    const r = await findProveedorByRfcEnOrg("XEXX010101000", "org1");
    expect(r).toBeNull();
  });

  it("findProveedorByRfcEnOrg devuelve null sin org", async () => {
    expect(await findProveedorByRfcEnOrg("ABC010101AAA", null)).toBeNull();
  });

  it("findProveedorByRfcEnOrg devuelve match", async () => {
    mock.setTableResult("proveedores", { data: { id: "p1", nombre: "ACME" }, error: null });
    const r = await findProveedorByRfcEnOrg("ABC010101AAA", "org1");
    expect(r?.id).toBe("p1");
  });

  it("insertProveedor inserta y devuelve fila", async () => {
    mock.setTableResult("proveedores", { data: { id: "p1", nombre: "ACME" }, error: null });
    const r = await insertProveedor({ nombre: "ACME", organization_id: "org1" } as never);
    expect(r.id).toBe("p1");
  });

  it("insertProveedor lanza ProveedorDuplicadoError en 23505", async () => {
    mock.setTableResult("proveedores", { data: null, error: { code: "23505" } });
    await expect(
      insertProveedor({ nombre: "X", rfc: "ABC010101AAA", organization_id: "org1" } as never),
    ).rejects.toBeInstanceOf(ProveedorDuplicadoError);
  });

  it("updateProveedor propaga error", async () => {
    mock.setTableResult("proveedores", { data: null, error: { message: "fail" } });
    await expect(updateProveedor("p1", { nombre: "X" } as never)).rejects.toBeTruthy();
  });

  it("deleteProveedor resuelve sin error", async () => {
    mock.setTableResult("proveedores", { data: null, error: null });
    await expect(deleteProveedor("p1")).resolves.toBeUndefined();
  });

  it("fetchProveedorOperaciones mapea joins", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [
        {
          concepto: "Flete",
          monto: "100",
          moneda: "USD",
          estado_liquidacion: "pendiente",
          fecha_vencimiento: "2026-01-01",
          embarques: { expediente: "EXP-1", id: "e1", cliente_nombre: "ACME" },
        },
      ],
      error: null,
    });
    const r = await fetchProveedorOperaciones("p1");
    expect(r[0].expediente).toBe("EXP-1");
    expect(r[0].monto).toBe(100);
  });
});
