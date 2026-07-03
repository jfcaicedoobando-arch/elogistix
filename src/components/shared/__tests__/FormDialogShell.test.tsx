import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Receipt } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";

const baseProps = {
  open: true,
  onOpenChange: () => {},
  icon: Receipt,
  title: "Nueva factura",
  description: "Captura los datos",
  footer: <button type="button">Guardar</button>,
};

describe("<FormDialogShell />", () => {
  it("renderiza title, description y footer", () => {
    render(
      <FormDialogShell {...baseProps}>
        <div>body</div>
      </FormDialogShell>,
    );
    expect(screen.getByText("Nueva factura")).toBeInTheDocument();
    expect(screen.getByText("Captura los datos")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("muestra headerAside cuando se pasa", () => {
    render(
      <FormDialogShell {...baseProps} headerAside={<span>Total: $100</span>}>
        <div />
      </FormDialogShell>,
    );
    expect(screen.getByText("Total: $100")).toBeInTheDocument();
  });

  it("renderiza stepper cuando totalSteps > 1", () => {
    render(
      <FormDialogShell
        {...baseProps}
        step={2}
        totalSteps={3}
        stepLabels={["Uno", "Dos", "Tres"]}
      >
        <div />
      </FormDialogShell>,
    );
    // El stepper etiqueta el paso activo y expone el conteo via aria-label.
    expect(screen.getByLabelText("Paso 2 de 3")).toBeInTheDocument();
    expect(screen.getByText(/Dos/)).toBeInTheDocument();
  });

  it("no renderiza el diálogo cuando open=false", () => {
    render(
      <FormDialogShell {...baseProps} open={false}>
        <div>hidden</div>
      </FormDialogShell>,
    );
    expect(screen.queryByText("hidden")).toBeNull();
  });
});
