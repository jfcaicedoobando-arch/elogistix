/**
 * A11Y-NEW-07 — ETD y ETA deben tener nombre accesible ligado a su etiqueta.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import type { EmbarqueFormValues } from "@/features/embarques/hooks";
import { StepDatosRutaFechas } from "../StepDatosRutaFechas";

function Wrapper() {
  // SAFE-CAST: el step sólo usa etd/eta del contexto del wizard.
  const methods = useForm<EmbarqueFormValues>({
    defaultValues: { etd: "2026-01-10", eta: "2026-02-10" } as EmbarqueFormValues,
  });
  return (
    <FormProvider {...methods}>
      <StepDatosRutaFechas errors={{}} />
    </FormProvider>
  );
}

describe("StepDatosRutaFechas · accesibilidad", () => {
  it("ETD y ETA se alcanzan por su etiqueta", () => {
    render(<Wrapper />);
    expect(screen.getByLabelText(/ETD \(Fecha Salida\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/ETA \(Fecha Llegada Estimada\)/i)).toBeInTheDocument();
  });
});
