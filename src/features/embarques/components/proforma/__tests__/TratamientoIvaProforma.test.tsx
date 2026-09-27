import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TratamientoIvaProforma } from "../TratamientoIvaProforma";
import { PasoConfirmacionProforma } from "../PasoConfirmacionProforma";
import { ConceptoRow } from "../PasoSeleccionConceptos.parts";
import { calcularTotalesProforma } from "@/features/proformas/domain";
import { formatCurrency } from "@/lib/formatters";
import type { Tables } from "@/types/db";

function concepto(tipo: string | null, over: Partial<Tables<"conceptos_venta">> = {}): Tables<"conceptos_venta"> {
  return {
    id: tipo ?? "pendiente", descripcion: `Servicio ${tipo ?? "pendiente"}`, moneda: "USD",
    cantidad: 1, precio_unitario: 1000, tipo_iva: tipo,
    tasa_iva_aplicada: tipo === "gravado_16" ? 0.16 : tipo === "gravado_8" ? 0.08 : 0,
    aplica_iva: tipo === "gravado_16" || tipo === "gravado_8", ...over,
  } as Tables<"conceptos_venta">;
}

describe("TratamientoIvaProforma", () => {
  it.each([
    ["gravado_16", "16%"], ["gravado_8", "8%"], ["tasa_0", "0%"],
    ["exento", "Exento"], ["no_objeto", "No objeto"], [null, "Por confirmar"],
  ])("conserva la clasificación %s sin reducirla a Sí/No", (tipo, etiqueta) => {
    render(<TratamientoIvaProforma concepto={concepto(tipo)} ivaActivo />);
    expect(screen.getByText(etiqueta)).toBeVisible();
    expect(screen.queryByText(/^(Sí|No)$/)).not.toBeInTheDocument();
  });
  it("desactivar el traslado USD no reclasifica un renglón gravado como exento", () => {
    render(<TratamientoIvaProforma concepto={concepto("gravado_16")} ivaActivo={false} />);
    expect(screen.getByText("16%")).toBeVisible();
    expect(screen.getByText("Sin traslado en esta proforma")).toBeVisible();
    expect(screen.queryByText("Exento")).not.toBeInTheDocument();
  });
  it("no objeto sigue siendo no objeto aun con override residual true", () => {
    render(<TratamientoIvaProforma concepto={concepto("no_objeto")} ivaActivo />);
    expect(screen.getByText("No objeto")).toBeVisible();
    expect(screen.queryByText("Sin traslado en esta proforma")).not.toBeInTheDocument();
  });
  it.each(["MXN", "USD"] as const)("selección muestra No objeto en %s", (moneda) => {
    render(<ConceptoRow c={concepto("no_objeto", { moneda })} isSelected ivaActivo={false}
      ivaBloqueado={moneda === "MXN"} ivaPendiente={false} contLabel={null}
      showGeneralBadge={false} onToggle={() => {}} onToggleIva={() => {}} />);
    expect(screen.getByText("No objeto")).toBeVisible();
    expect(screen.queryByText("Sin IVA")).not.toBeInTheDocument();
  });
  it("confirmación mixta conserva etiquetas, filas y totales del dominio sin mutar conceptos", () => {
    const conceptos = [concepto("gravado_16", { precio_unitario: 7500 }), concepto("no_objeto", { precio_unitario: 1250 })];
    const antes = structuredClone(conceptos);
    const overrides = { gravado_16: true, no_objeto: false };
    const totales = calcularTotalesProforma(conceptos, 0.16, overrides);
    render(<PasoConfirmacionProforma conceptosSeleccionados={conceptos} ivaPorConcepto={overrides}
      totales={totales} tasaIva={0.16} notas="" pendientesIva={[]} />);
    expect(screen.getByText("Tratamiento IVA")).toBeVisible();
    expect(screen.getByText("16%")).toBeVisible();
    expect(screen.getByText("No objeto")).toBeVisible();
    expect(screen.getByText(formatCurrency(1200, "USD"))).toBeVisible();
    expect(screen.getByText(formatCurrency(9950, "USD"))).toBeVisible();
    expect(conceptos).toEqual(antes);
    expect(totales.subtotal_usd).toBe(8750);
  });
});
