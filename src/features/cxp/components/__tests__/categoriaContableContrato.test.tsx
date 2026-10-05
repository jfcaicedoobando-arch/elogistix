import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoriaContableSection } from "../FacturaProveedorFormFields.categoria";
import { mapProveedorFacturaRows } from "@/lib/mappers/estadoResultadosRows";
import { costosDeProveedorFacturas, type CostosBucket } from "@/features/profit/services/estadoResultadosBuckets";
describe("64: explicación de categoría y vínculos existentes", () => {
  it("explica el efecto presupuestario sin prometer excluir el costo ni el devengado", () => {
    render(<CategoriaContableSection value="adm" onChange={() => {}} categorias={[{ id: "adm", nombre: "Administración" }]} />);
    expect(screen.getByText(/La categoría clasifica la factura para el presupuesto/)).toHaveTextContent("Cambiarla a Administración no desvincula los costos existentes del embarque ni excluye la factura del Estado de Resultados devengado");
    expect(screen.queryByText(/deja de contar como costo/)).toBeNull();
  });
  it("el contrato devengado mantiene la misma base neta con Administración y COGS", () => {
    const generar = (categoria: string) => {
      const rows = mapProveedorFacturaRows([{ id: "f1", embarque_id: "e1", subtotal: 1000, total: 1160, moneda: "MXN", fecha_emision: "2026-10-04", tipo_cambio_usd: null, categoria_presupuesto_id: categoria }]);
      const out: CostosBucket = { embarques: [], costos: [] };
      costosDeProveedorFacturas(rows, [{ id: "e1", modo: "Marítimo", tipo_cambio_usd: 20, tipo_cambio_eur: 22 }], out, { usd: 20, eur: 22 });
      return out;
    };
    const administracion = generar("administracion");
    expect(administracion).toEqual(generar("cogs"));
    expect(administracion.costos[0].monto).toBe(1000);
    expect(administracion.embarques[0].modo).toBe("Marítimo");
  });
});
