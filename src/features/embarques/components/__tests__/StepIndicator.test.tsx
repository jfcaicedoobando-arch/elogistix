import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StepIndicator } from "@/features/embarques/components/StepIndicator";

const STEPS = [
  { num: 1, title: "Datos Generales", shortTitle: "Generales" },
  { num: 2, title: "Costos y utilidad", shortTitle: "Costos" },
  { num: 3, title: "Cotización del cliente", shortTitle: "Cliente" },
  { num: 4, title: "Resumen" },
];

describe("<StepIndicator />", () => {
  it("mantiene el título completo accesible aunque muestre el corto", () => {
    render(<StepIndicator steps={STEPS} currentStep={3} />);

    expect(screen.getByLabelText("Progreso del wizard")).toBeInTheDocument();
    expect(screen.getByLabelText("Paso actual 3: Cotización del cliente")).toBeInTheDocument();
  });

  it("muestra la etiqueta corta cuando el paso la tiene", () => {
    render(<StepIndicator steps={STEPS} currentStep={3} />);

    expect(screen.getByText("Cliente")).toBeInTheDocument();
    expect(screen.getByTitle("Cotización del cliente")).toHaveTextContent("Cliente");
  });

  it("muestra el título completo cuando no hay etiqueta corta", () => {
    render(<StepIndicator steps={STEPS} currentStep={4} />);

    expect(screen.getByText("Resumen")).toBeInTheDocument();
    expect(screen.getByTitle("Resumen")).toHaveTextContent("Resumen");
  });

  it("usa el título completo en el aria-label de los pasos navegables", () => {
    render(<StepIndicator steps={STEPS} currentStep={4} onStepClick={(s) => s} />);

    expect(screen.getByRole("button", { name: "Ir al paso 1: Datos Generales" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir al paso 3: Cotización del cliente" })).toBeInTheDocument();
  });
});
