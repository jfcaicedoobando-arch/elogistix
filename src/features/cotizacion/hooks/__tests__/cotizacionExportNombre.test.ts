/**
 * v13.823.355 (YAGNI r2 · P1) — el CSV usa el mismo nombre que la tabla.
 * En prospectos `cliente_nombre` es NULL y el nombre visible es
 * `prospecto_empresa`; antes la columna Cliente salía vacía.
 */
import { describe, it, expect } from "vitest";
import { nombreMostradoCotizacion } from "@/features/cotizacion/hooks/useCotizacionActions";

describe("nombreMostradoCotizacion", () => {
  it("usa prospecto_empresa en prospectos", () => {
    expect(nombreMostradoCotizacion({
      folio: "COT-1", cliente_nombre: null, es_prospecto: true, prospecto_empresa: "Aceros del Norte",
    })).toBe("Aceros del Norte");
  });

  it("usa cliente_nombre en cotizaciones de cliente", () => {
    expect(nombreMostradoCotizacion({
      folio: "COT-2", cliente_nombre: "Cliente SA", es_prospecto: false, prospecto_empresa: null,
    })).toBe("Cliente SA");
  });

  it("no rompe cuando faltan ambos", () => {
    expect(nombreMostradoCotizacion({ folio: "COT-3", cliente_nombre: null })).toBe("");
  });
});
