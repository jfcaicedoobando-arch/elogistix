import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WizardShell, type WizardStep } from "@/components/shared/WizardShell";

const STEPS: WizardStep[] = [
  { num: 1, title: "Uno" },
  { num: 2, title: "Dos" },
  { num: 3, title: "Tres" },
];

describe("<WizardShell />", () => {
  it("renderiza título, subtítulo y pasos", () => {
    render(
      <WizardShell
        title="Wizard"
        subtitle="Sub"
        steps={STEPS}
        currentStep={1}
        onBack={() => {}}
      >
        <div>Contenido paso 1</div>
      </WizardShell>,
    );
    expect(screen.getByText("Wizard")).toBeInTheDocument();
    expect(screen.getByText("Sub")).toBeInTheDocument();
    expect(screen.getByText("Contenido paso 1")).toBeInTheDocument();
  });

  it("invoca onBack al hacer click en Volver", () => {
    const onBack = vi.fn();
    render(
      <WizardShell title="W" steps={STEPS} currentStep={1} onBack={onBack}>
        <div />
      </WizardShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(onBack).toHaveBeenCalled();
  });

  it("footer default: primer paso muestra Cancelar y Siguiente", () => {
    const onPrev = vi.fn();
    const onNext = vi.fn();
    render(
      <WizardShell
        title="W"
        steps={STEPS}
        currentStep={1}
        onBack={() => {}}
        defaultFooter={{ onPrev, onNext, saveLabel: "Guardar" }}
      >
        <div />
      </WizardShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    expect(onPrev).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });

  it("footer default: último paso muestra Anterior y Guardar (usa onSave)", () => {
    const onSave = vi.fn();
    render(
      <WizardShell
        title="W"
        steps={STEPS}
        currentStep={3}
        onBack={() => {}}
        defaultFooter={{
          onPrev: () => {},
          onNext: () => {},
          onSave,
          saveLabel: "Guardar",
        }}
      >
        <div />
      </WizardShell>,
    );
    expect(screen.getByRole("button", { name: /anterior/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(onSave).toHaveBeenCalled();
  });

  it("isBusy deshabilita back y footer default", () => {
    const onBack = vi.fn();
    const onNext = vi.fn();
    render(
      <WizardShell
        title="W"
        steps={STEPS}
        currentStep={1}
        onBack={onBack}
        isBusy
        defaultFooter={{ onPrev: () => {}, onNext, saveLabel: "Guardar" }}
      >
        <div />
      </WizardShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: /volver/i }));
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByText(/guardando/i)).toBeInTheDocument();
  });

  it("renderiza footer custom cuando se pasa el prop", () => {
    render(
      <WizardShell
        title="W"
        steps={STEPS}
        currentStep={2}
        onBack={() => {}}
        footer={<button type="button">Footer custom</button>}
      >
        <div />
      </WizardShell>,
    );
    expect(screen.getByRole("button", { name: /footer custom/i })).toBeInTheDocument();
  });
});
