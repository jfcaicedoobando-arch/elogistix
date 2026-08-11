import { describe, it, expect } from "vitest";
import { resolverProveedorIdPorNombre } from "@/features/embarques/domain/resolverProveedor";
import { buildConceptosCostoPayload } from "@/features/embarques/domain/mappers/embarqueToDb";

const CATALOGO = [
  { id: "id-wan", nombre: "WAN HAI LINES MEXICO" },
  { id: "id-cosco-mx", nombre: "COSCO SHIPPING LINES MEXICO S DE RL DE CV" },
  { id: "id-cosco-ltd", nombre: "COSCO SHIPPING LINES CO. LTD" },
];

describe("resolverProveedorIdPorNombre", () => {
  it("resuelve por coincidencia exacta sin importar mayúsculas", () => {
    expect(resolverProveedorIdPorNombre("wan hai lines mexico", CATALOGO)).toBe("id-wan");
  });

  it("resuelve por prefijo cuando hay un único candidato", () => {
    expect(resolverProveedorIdPorNombre("Wan Hai Lines", CATALOGO)).toBe("id-wan");
  });

  it("no resuelve cuando el prefijo es ambiguo", () => {
    expect(resolverProveedorIdPorNombre("COSCO Shipping Lines", CATALOGO)).toBe("");
  });

  it("devuelve cadena vacía con nombre vacío", () => {
    expect(resolverProveedorIdPorNombre("   ", CATALOGO)).toBe("");
    expect(resolverProveedorIdPorNombre(null, CATALOGO)).toBe("");
  });
});

describe("buildConceptosCostoPayload · conserva el proveedor heredado", () => {
  const base = { id: 1, dbId: "uuid-1", concepto: "Flete Maritimo", monto: 1000, moneda: "USD" };

  it("no borra el nombre cuando el costo no tiene proveedor de catálogo", () => {
    const [fila] = buildConceptosCostoPayload(
      [{ ...base, proveedorId: "", proveedorNombre: "COSCO Shipping Lines" }],
      CATALOGO,
    );
    expect(fila.proveedor_id).toBeNull();
    expect(fila.proveedor_nombre).toBe("COSCO Shipping Lines");
  });

  it("usa el nombre del catálogo cuando sí hay proveedor seleccionado", () => {
    const [fila] = buildConceptosCostoPayload(
      [{ ...base, proveedorId: "id-wan", proveedorNombre: "Wan Hai Lines" }],
      CATALOGO,
    );
    expect(fila.proveedor_id).toBe("id-wan");
    expect(fila.proveedor_nombre).toBe("WAN HAI LINES MEXICO");
  });

  it("queda vacío sólo cuando no hay ni id ni nombre heredado", () => {
    const [fila] = buildConceptosCostoPayload([{ ...base, proveedorId: "" }], CATALOGO);
    expect(fila.proveedor_nombre).toBe("");
  });
});
