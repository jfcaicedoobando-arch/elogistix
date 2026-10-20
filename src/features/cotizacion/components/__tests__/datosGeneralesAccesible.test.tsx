/**
 * A11Y-NEW-08 — los selectores del paso 1 (modo, operación, incoterm) deben
 * tener nombre accesible, no un combobox anónimo.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm, FormProvider } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/hooks";
import SeccionDatosGeneralesCotizacion from "../SeccionDatosGeneralesCotizacion";

const permisos = vi.hoisted(() => ({ canReasignarVendedorCrm: true }));

vi.mock("@/hooks/shared", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/hooks/shared")>()),
  usePermissions: () => permisos,
}));
vi.mock("@/features/admin/hooks/usuario", () => ({
  useUsuarios: () => ({ data: [{ user_id: "u-1", email: "vendedora@ejemplo.mx", role: "vendedor" }] }),
}));

function Wrapper() {
  // SAFE-CAST: la sección sólo consume modo/tipo/incoterm/vendedorId del contexto.
  const methods = useForm<CotizacionFormValues>({
    defaultValues: {
      modo: "Marítimo", tipo: "Importación", incoterm: "FOB", numContenedores: 0, vendedorId: null,
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
    permisos.canReasignarVendedorCrm = true;
    render(<Wrapper />);
    expect(screen.getByRole("combobox", { name: "Modo de transporte" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Tipo de operación" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Incoterm" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Comercial" })).toBeInTheDocument();
  });

  it("sin permiso de reasignar no se muestra el selector de Comercial (igual que en Oportunidades)", () => {
    permisos.canReasignarVendedorCrm = false;
    render(<Wrapper />);
    expect(screen.queryByRole("combobox", { name: "Comercial" })).not.toBeInTheDocument();
  });
});
