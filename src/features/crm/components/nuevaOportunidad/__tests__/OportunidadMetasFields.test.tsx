import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import OportunidadMetasFields from "../OportunidadMetasFields";
import OportunidadMontosFields from "../OportunidadMontosFields";
import { EMPTY_OPORTUNIDAD, type OportunidadFormState } from "@/features/crm/domain/oportunidadFormState";
import { buildOportunidadFormPayload } from "@/features/crm/domain/oportunidadFormPayload";

function Formulario({ margen = "" }: { margen?: OportunidadFormState["margen_pct"] }) {
  const [form, setForm] = useState({ ...EMPTY_OPORTUNIDAD, margen_pct: margen });
  const set = <K extends keyof OportunidadFormState>(key: K, value: OportunidadFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  return <>
    <OportunidadMetasFields form={form} set={set} />
    <OportunidadMontosFields form={form} set={set} esGanada={false} />
  </>;
}

describe("Campos comerciales de oportunidad", () => {
  it("inicia sin cero y permite capturar, borrar y volver a capturar el margen", () => {
    render(<Formulario />);
    const input = screen.getByLabelText("Margen esperado (%)");
    expect(input).toHaveValue(null);
    fireEvent.change(input, { target: { value: "25.5" } });
    expect(input).toHaveValue(25.5);
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue(null);
    fireEvent.change(input, { target: { value: "15" } });
    expect(input).toHaveValue(15);
  });

  it("permite borrar un cero existente y conserva el límite de 100", () => {
    render(<Formulario margen={0} />);
    const input = screen.getByLabelText("Margen esperado (%)");
    expect(input).toHaveValue(0);
    fireEvent.change(input, { target: { value: "" } });
    expect(input).toHaveValue(null);
    fireEvent.change(input, { target: { value: "150" } });
    expect(input).toHaveValue(100);
    fireEvent.change(input, { target: { value: "-5" } });
    expect(input).toHaveValue(0);
  });

  it("muestra las etiquetas solicitadas", () => {
    render(<Formulario />);
    expect(screen.getByLabelText("Valor estimado")).toBeInTheDocument();
    expect(screen.getByText("Fecha estimada de cierre")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor real")).toBeInTheDocument();
    expect(screen.queryByText("Monto meta")).not.toBeInTheDocument();
    expect(screen.queryByText("Monto estimado")).not.toBeInTheDocument();
  });

  it("conserva el contrato de guardado: margen vacío o cero como nulo", () => {
    expect(buildOportunidadFormPayload(EMPTY_OPORTUNIDAD, false).margen_pct).toBeNull();
    expect(buildOportunidadFormPayload({ ...EMPTY_OPORTUNIDAD, margen_pct: 0 }, false).margen_pct).toBeNull();
    expect(buildOportunidadFormPayload({ ...EMPTY_OPORTUNIDAD, margen_pct: 25.5 }, false).margen_pct).toBe(25.5);
  });
});