import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  esEmbarqueArribado,
  esEtaVencida,
  calcularFasesEmbarque,
  type EmbarqueFasesInput,
} from "@/features/embarques/domain/embarqueFases";
import { FasesEmbarqueStepper } from "../tracking/FasesEmbarqueStepper";

const BASE: EmbarqueFasesInput = {
  modo: "Marítimo",
  tipo: "Importación",
  estado: "En Tránsito",
  etd: "2026-01-05",
  eta: "2026-02-10",
  fecha_creacion: "2026-01-01T00:00:00.000Z",
  fecha_llegada_real: null,
  cotizacion_id: "cot-1",
  updated_at: "2026-01-20T00:00:00.000Z",
};

describe("FasesEmbarqueStepper", () => {
  it("ambas variantes usan la misma fuente de verdad (mismo número de nodos)", () => {
    const fases = calcularFasesEmbarque(BASE);

    const { unmount } = render(<FasesEmbarqueStepper embarque={BASE} variant="compacta" />);
    expect(screen.getByTestId("fases-stepper")).toHaveAttribute("data-variant", "compacta");
    expect(screen.getByText(`Paso 3 de ${fases.length}`)).toBeInTheDocument();
    unmount();

    render(<FasesEmbarqueStepper embarque={BASE} variant="completa" />);
    expect(screen.getByTestId("fases-stepper")).toHaveAttribute("data-variant", "completa");
    // Escritorio + móvil renderizan la misma lista: 2 etiquetas por fase.
    expect(screen.getAllByText("En Tránsito")).toHaveLength(2);
  });

  it("marca la fase actual con aria-current", () => {
    render(<FasesEmbarqueStepper embarque={BASE} variant="compacta" />);
    expect(document.querySelectorAll('[aria-current="step"]')).toHaveLength(1);
  });

  it("las fases futuras con fecha se muestran como estimadas", () => {
    render(<FasesEmbarqueStepper embarque={BASE} variant="completa" />);
    expect(screen.getAllByText(/^est\. /).length).toBeGreaterThan(0);
  });
});

describe("helpers temporales del embarque", () => {
  it("un embarque entregado o con llegada real se considera arribado", () => {
    expect(esEmbarqueArribado({ estado: "Entregado", eta: "2026-01-01", fecha_llegada_real: null })).toBe(true);
    expect(esEmbarqueArribado({ estado: "En Tránsito", eta: null, fecha_llegada_real: "2026-01-02" })).toBe(true);
    expect(esEmbarqueArribado({ estado: "En Tránsito", eta: null, fecha_llegada_real: null })).toBe(false);
  });

  it("la ETA de un embarque arribado nunca está vencida", () => {
    expect(esEtaVencida({ estado: "Cerrado", eta: "2020-01-01", fecha_llegada_real: null })).toBe(false);
    expect(esEtaVencida({ estado: "En Tránsito", eta: "2020-01-01", fecha_llegada_real: null })).toBe(true);
    expect(esEtaVencida({ estado: "En Tránsito", eta: "2999-01-01", fecha_llegada_real: null })).toBe(false);
  });
});
