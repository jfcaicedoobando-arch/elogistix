import { describe, it, expect, vi } from "vitest";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
import { claveDesdeEtiqueta, etiquetaVigente, idVigente, type OpcionCrm } from "../propiedadesCrm";
import { filaValor } from "../valoresCrm";

const op = (id: string, etiqueta: string, reemplaza_a: string | null = null, archivada = false): OpcionCrm =>
  ({ id, etiqueta, orden: 1, archivada, reemplaza_a });

describe("propiedades CRM", () => {
  it("genera clave sin acentos ni símbolos", () => {
    expect(claveDesdeEtiqueta("Nivel de decisión (TEUs)")).toBe("nivel_de_decision_teus");
  });
  it("un valor viejo muestra el nombre vigente tras renombrar", () => {
    const opciones = [op("a", "Terrestre", null, true), op("b", "Terrestre (Camión | Tráiler)", "a")];
    expect(etiquetaVigente(opciones, "a")).toBe("Terrestre (Camión | Tráiler)");
    expect(idVigente(opciones, "a")).toBe("b");
  });
  it("guarda cada tipo en su columna y vacíos en null", () => {
    expect(filaValor("numero", "12.5").valor_numero).toBe(12.5);
    expect(filaValor("seleccion", "x").opcion_ids).toEqual(["x"]);
    expect(filaValor("texto", "")).toEqual({ valor_texto: null, valor_numero: null, valor_fecha: null, opcion_ids: null });
    expect(() => filaValor("numero", "abc")).toThrow("número");
  });
});
