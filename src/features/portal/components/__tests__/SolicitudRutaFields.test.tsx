/**
 * Etapa 5 · campos de ruta de la solicitud del portal: catálogo en Marítimo,
 * texto libre siempre permitido y IDs limpios en otros modos.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SolicitudRutaFields } from "../SolicitudRutaFields";

interface PortProps {
  id?: string;
  value: string;
  placeholder?: string;
  excludeId?: string | null;
  onValueChange: (v: string, pid: string | null) => void;
}

const capturados: PortProps[] = [];

vi.mock("@/features/catalogos", () => ({
  PortSelect: (props: PortProps) => {
    capturados.push(props);
    return (
      <button
        type="button"
        id={props.id}
        data-excludeid={props.excludeId ?? ""}
        onClick={() => props.onValueChange("Valencia, España (ESVLC)", "p-9")}
      >
        {props.value || props.placeholder}
      </button>
    );
  },
}));

function renderFields(over: Partial<React.ComponentProps<typeof SolicitudRutaFields>> = {}) {
  const setOrigen = vi.fn();
  const setDestino = vi.fn();
  render(
    <SolicitudRutaFields
      modo={over.modo ?? "Marítimo"}
      origen={over.origen ?? ""}
      setOrigen={over.setOrigen ?? setOrigen}
      destino={over.destino ?? ""}
      setDestino={over.setDestino ?? setDestino}
      puertoOrigenId={over.puertoOrigenId ?? null}
      puertoDestinoId={over.puertoDestinoId ?? null}
      intentoEnvio={over.intentoEnvio ?? false}
      origenVacio={over.origenVacio ?? true}
      destinoVacio={over.destinoVacio ?? true}
    />,
  );
  return { setOrigen, setDestino };
}

describe("SolicitudRutaFields · Etapa 5", () => {
  beforeEach(() => { capturados.length = 0; });

  it("en Marítimo usa el buscador de puertos y emite texto + ID", () => {
    const { setOrigen } = renderFields();
    fireEvent.click(screen.getByText("Busca o escribe puerto de origen"));
    expect(setOrigen).toHaveBeenCalledWith("Valencia, España (ESVLC)", "p-9");
  });

  it("excluye el puerto ya usado en el otro extremo", () => {
    renderFields({ puertoDestinoId: "p-2", puertoOrigenId: "p-1" });
    expect(capturados[0].excludeId).toBe("p-2");
    expect(capturados[1].excludeId).toBe("p-1");
  });

  it("en modos no marítimos usa inputs de texto con ID nulo", () => {
    const { setDestino } = renderFields({ modo: "Aéreo" });
    expect(capturados).toHaveLength(0);
    const input = screen.getByLabelText(/^Destino/i);
    fireEvent.change(input, { target: { value: "Ciudad de México" } });
    expect(setDestino).toHaveBeenCalledWith("Ciudad de México", null);
  });

  it("no usa ejemplos sesgados a un país", () => {
    renderFields({ modo: "Terrestre" });
    expect(screen.queryByPlaceholderText(/China|Shanghái|Manzanillo/i)).toBeNull();
  });
});
