/**
 * A11Y-NEW-08 — los selectores del paso 1 (modo, operación, incoterm) deben
 * tener nombre accesible, no un combobox anónimo.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";
import SeccionDatosGeneralesCotizacion from "../SeccionDatosGeneralesCotizacion";

function Wrapper() {
  // SAFE-CAST: la sección sólo consume modo/tipo/incoterm del contexto.
  const methods = useForm<CotizacionFormValues>({
    defaultValues: {
      modo: "Marítimo", tipo: "Importación", incoterm: "FOB", numContenedores: 0,
    } as CotizacionFormValues,
  });
  return (
    <FormProvider {...methods}>
      <SeccionDatosGeneralesCotizacion />
    </FormProvider>
  );
}

describe("SeccionDatosGeneralesCotizacion · accesibilidad", () => {
  it("cada selector tiene nombre accesible", () => {
    render(<Wrapper />);
    expect(screen.getByRole("combobox", { name: "Modo de transporte" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tipo de operación" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Incoterm" })).toBeInTheDocument();
  });
});
