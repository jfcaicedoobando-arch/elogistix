/**
 * Etapa 4 · la ruta de la oportunidad captura texto + ID de puerto de forma
 * atómica en Marítimo y admite texto libre (ID null). La transición de modo se
 * cubre en las pruebas puras de `domain/oportunidadRuta.ts`.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  render(<OportunidadRutaFields form={estado} set={vi.fn()} setForm={setForm} />);
  return { get: () => estado };
}

/** Abre el buscador de puertos del extremo pedido (orden de render: origen, destino). */
function abrirPuerto(indice: number) {
  const triggers = screen.getAllByRole("combobox");
  // El primer combobox es el Select de modo.
  fireEvent.click(triggers[indice + 1]);
}

describe("OportunidadRutaFields", () => {
  it("selección de catálogo guarda texto e ID juntos", () => {
    const { get } = renderRuta({ modo: "Marítimo" });
    abrirPuerto(0);
    fireEvent.click(screen.getByRole("option", { name: /CNSHA/ }));
    expect(get().origen).toBe("Shanghai, China (CNSHA)");
    expect(get().puerto_origen_id).toBe("p-sha");
  });

  it("texto libre guarda el texto con ID null", async () => {
    const { get } = renderRuta({ modo: "Marítimo" });
    abrirPuerto(1);
    fireEvent.change(screen.getByPlaceholderText(/buscar puerto/i), {
      target: { value: "Manzillo" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /usar/i }));
    expect(get().destino).toBe("Manzillo");
    expect(get().puerto_destino_id).toBeNull();
  });

  it("origen igual al destino no queda persistible: limpia el otro ID", () => {
    const { get } = renderRuta({
      modo: "Marítimo",
      destino: "Manzanillo, México (MXZLO)",
      puerto_destino_id: "p-zlo",
    });
    abrirPuerto(0);
    fireEvent.click(screen.getByRole("option", { name: /MXZLO/ }));
    expect(get().puerto_origen_id).toBe("p-zlo");
    expect(get().puerto_destino_id).toBeNull();
  });

  it("en modo no marítimo usa texto libre y no muestra buscador de puertos", () => {
    renderRuta({ modo: "Aéreo" });
    expect(screen.getAllByRole("combobox")).toHaveLength(1);
  });

  it("modo legacy no reconocible muestra advertencia accionable", () => {
    renderRuta({ modo: "FCL" });
    expect(screen.getByRole("alert").textContent).toMatch(/no corresponde/i);
  });
});
