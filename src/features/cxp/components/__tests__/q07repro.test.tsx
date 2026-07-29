import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FacturaProveedorFormFields } from "@/features/cxp/components/FacturaProveedorFormFields";
import { initialValues } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.helpers";

function Harness() {
  const [values, setValues] = useState(initialValues());
  const onChange = (k: any, v: any) => setValues((p) => ({ ...p, [k]: v }));
  return (
    <FacturaProveedorFormFields
      values={values}
      onChange={onChange}
      onProveedor={() => {}}
      categorias={[]}
      total={0}
    />
  );
}

describe("Q-07 repro", () => {
  it("teclear subtotal -> iva -> retenciones conserva los tres valores", () => {
    const qc = new QueryClient();
    render(<QueryClientProvider client={qc}><Harness /></QueryClientProvider>);
    const subtotal = screen.getByLabelText("Subtotal");
    const iva = screen.getByLabelText("IVA");
    const ret = screen.getByLabelText("Retenciones");
    fireEvent.change(subtotal, { target: { value: "1000" } });
    fireEvent.change(iva, { target: { value: "160" } });
    fireEvent.change(ret, { target: { value: "50" } });
    expect((subtotal as HTMLInputElement).value).toBe("1000");
    expect((iva as HTMLInputElement).value).toBe("160");
    expect((ret as HTMLInputElement).value).toBe("50");
  });
});
