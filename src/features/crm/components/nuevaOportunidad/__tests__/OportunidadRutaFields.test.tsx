/**
 * Etapa 4 · la ruta de la oportunidad captura texto + ID de puerto de forma
 * atómica en Marítimo, admite texto libre (ID null) y limpia los IDs al salir
 * de Marítimo. Se prueba el contrato de `setForm` (el reductor real del form).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import OportunidadRutaFields from "@/features/crm/components/nuevaOportunidad/OportunidadRutaFields";
import { EMPTY_OPORTUNIDAD } from "@/features/crm/domain/oportunidadFormState";
import type { OportunidadFormState } from "@/features/crm/hooks";

vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => ({
    data: [
      { id: "p-sha", code: "CNSHA", name: "Shanghai", country: "China" },
      { id: "p-zlo", code: "MXZLO", name: "Manzanillo", country: "México" },
    ],
  }),
}));

function renderRuta(inicial: Partial<OportunidadFormState>) {
  let estado: OportunidadFormState = { ...EMPTY_OPORTUNIDAD, ...inicial };
  const setForm = vi.fn((fn: unknown) => {
    estado = typeof fn === "function"
      ? (fn as (f: OportunidadFormState) => OportunidadFormState)(estado)
      : (fn as OportunidadFormState);
  });
  render(
    <OportunidadRutaFields form={estado} set={vi.fn()} setForm={setForm} />,
  );
  return { get: () => estado };
}

describe("OportunidadRutaFields", () => {
  it("selección de catálogo guarda texto e ID juntos", async () => {
    const user = userEvent.setup();
    const { get } = renderRuta({ modo: "Marítimo" });
    await user.click(screen.getByRole("combobox", { name: /origen/i }));
    await user.click(screen.getByText("Shanghai, China (CNSHA)"));
    expect(get().origen).toBe("Shanghai, China (CNSHA)");
    expect(get().puerto_origen_id).toBe("p-sha");
  });

  it("texto libre guarda el texto con ID null", async () => {
    const user = userEvent.setup();
    const { get } = renderRuta({ modo: "Marítimo" });
    await user.click(screen.getByRole("combobox", { name: /destino/i }));
    await user.type(screen.getByPlaceholderText(/buscar puerto/i), "Manzillo");
    await user.click(screen.getByRole("button", { name: /usar/i }));
    expect(get().destino).toBe("Manzillo");
    expect(get().puerto_destino_id).toBeNull();
  });

  it("origen igual al destino no queda persistible: limpia el otro ID", async () => {
    const user = userEvent.setup();
    const { get } = renderRuta({
      modo: "Marítimo",
      destino: "Manzanillo, México (MXZLO)",
      puerto_destino_id: "p-zlo",
    });
    await user.click(screen.getByRole("combobox", { name: /origen/i }));
    await user.click(screen.getByText("Manzanillo, México (MXZLO)"));
    expect(get().puerto_origen_id).toBe("p-zlo");
    expect(get().puerto_destino_id).toBeNull();
  });

  it("cambiar a un modo no marítimo limpia los IDs y conserva el texto", async () => {
    const user = userEvent.setup();
    const { get } = renderRuta({
      modo: "Marítimo",
      origen: "Shanghai, China (CNSHA)",
      puerto_origen_id: "p-sha",
      destino: "Manzanillo, México (MXZLO)",
      puerto_destino_id: "p-zlo",
    });
    await user.click(screen.getByRole("combobox", { name: /modo/i }));
    await user.click(screen.getByRole("option", { name: "Aéreo" }));
    expect(get().modo).toBe("Aéreo");
    expect(get().puerto_origen_id).toBeNull();
    expect(get().puerto_destino_id).toBeNull();
    expect(get().origen).toBe("Shanghai, China (CNSHA)");
  });

  it("modo legacy no reconocible muestra advertencia accionable", () => {
    renderRuta({ modo: "FCL" });
    expect(screen.getByRole("alert").textContent).toMatch(/no corresponde/i);
  });
});
