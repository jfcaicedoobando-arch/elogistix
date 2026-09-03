import { describe, it, expect } from "vitest";
import { ProformaDocument } from "../ProformaDocument";
import { render } from "@testing-library/react";
import { makeProforma, makeEmbarque } from "@/test/fixtures";

const mockProforma = makeProforma({
  numero: "PROF-001",
  fecha_emision: "2023-01-15",
  expediente: "EXP-2024-99",
  cliente_nombre: "Acme Corp",
  subtotal_usd: 100,
  iva_usd: 16,
  total_usd: 116,
  subtotal_mxn: 0,
  iva_mxn: 0,
  total_mxn: 0,
});

const mockEmbarque = makeEmbarque({
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  puerto_origen: "Shanghai",
  puerto_destino: "Manzanillo",
  descripcion_mercancia: "Carga seca general",
});

const mockConcepto = {
  descripcion: "Flete marítimo Shanghai-Manzanillo",
  moneda: "USD",
  cantidad: 1,
  precio_unitario: 100,
  subtotal: 100,
  aplica_iva: true,
} as unknown as Parameters<typeof ProformaDocument>[0]["conceptos"][number];

describe("ProformaDocument", () => {
  it("muestra número, expediente, cliente, modo y puertos en el documento", () => {
    const { container, getByTestId } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[mockConcepto]} />,
    );
    const text = container.textContent ?? "";
    expect(getByTestId("pdf-doc")).toBeInTheDocument();
    expect(text).toContain("PROF-001");
    expect(text).toContain("EXP-2024-99");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("Marítimo");
    expect(text).toContain("Importación");
    expect(text).toContain("Shanghai");
    expect(text).toContain("Manzanillo");
    expect(text).toContain("Carga seca general");
  });

  it("renderiza concepto y aviso 'sin validez fiscal'", () => {
    const { container } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[mockConcepto]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Flete marítimo Shanghai-Manzanillo");
    expect(text).toMatch(/sin validez fiscal/i);
  });

  it("muestra BL House y lista de contenedores en el header cuando existen", () => {
    const proforma = makeProforma({
      numero: "PROF-001",
      fecha_emision: "2023-01-15",
      expediente: "EXP-2024-99",
      cliente_nombre: "Acme Corp",
      bl_master: "MAEU123456789",
    });
    const base = makeEmbarque({
      modo: "Marítimo",
      tipo: "Importación",
      incoterm: "FOB",
      puerto_origen: "Shanghai",
      puerto_destino: "Manzanillo",
      bl_house: "HBL-2026-0007",
    });
    const embarque = {
      ...base,
      contenedores: [
        { id: "c1", numero_contenedor: "MSCU1234567", tipo_contenedor: "40HC" },
      ],
    } as unknown as Parameters<typeof ProformaDocument>[0]["embarque"];
    const { container } = render(
      <ProformaDocument proforma={proforma} embarque={embarque} conceptos={[mockConcepto]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("BL Master / MAWB");
    expect(text).toContain("MAEU123456789");
    expect(text).toContain("BL House / HAWB");
    expect(text).toContain("HBL-2026-0007");
    expect(text).toContain("Contenedores");
    expect(text).toContain("MSCU1234567");
    expect(text).toContain("40HC");
  });

  it("no renderiza fila Contenedores cuando no hay contenedores", () => {
    const { container } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[mockConcepto]} />,
    );
    const text = container.textContent ?? "";
    expect(text).not.toContain("Contenedores");
    expect(text).not.toContain("BL House");
  });

  it("omite la fila 'Ruta' redundante y no imprime el separador de flecha", () => {
    const { container } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[mockConcepto]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Origen");
    expect(text).toContain("Destino");
    expect(text).not.toContain("Ruta");
    expect(text).not.toContain("→");
  });

  it("no muestra el subtítulo de moneda con una sola moneda, pero conserva el título de conceptos", () => {
    const { container } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[mockConcepto]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Conceptos");
    expect(text).not.toContain("Conceptos en USD");
  });

  it("muestra los subtítulos de moneda cuando conviven USD y MXN", () => {
    const conceptoMxn = {
      ...mockConcepto,
      descripcion: "Maniobras en destino",
      moneda: "MXN",
    } as unknown as typeof mockConcepto;
    const proforma = makeProforma({
      numero: "PROF-002",
      fecha_emision: "2023-01-15",
      expediente: "EXP-2024-99",
      cliente_nombre: "Acme Corp",
      subtotal_usd: 100,
      iva_usd: 16,
      total_usd: 116,
      subtotal_mxn: 100,
      iva_mxn: 16,
      total_mxn: 116,
    });
    const { container } = render(
      <ProformaDocument
        proforma={proforma}
        embarque={mockEmbarque}
        conceptos={[mockConcepto, conceptoMxn]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Conceptos en USD");
    expect(text).toContain("Conceptos en MXN");
  });

  it("muestra la vigencia una sola vez (en condiciones de pago)", () => {
    const { container } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[mockConcepto]} />,
    );
    const text = container.textContent ?? "";
    expect(text.match(/Vigencia/g)?.length ?? 0).toBe(1);
  });
});
