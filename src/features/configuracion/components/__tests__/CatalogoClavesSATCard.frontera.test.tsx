/**
 * P2-IVA (seguimiento) — el catálogo no permite dar de alta ni cambiar un
 * producto a IVA 8% con el estímulo fronterizo apagado; un producto ya guardado
 * al 8% se sigue editando conservando su valor.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditRow } from "@/features/configuracion/components/CatalogoClavesSATCard.parts";
import { EMPTY_DRAFT, type Draft } from "@/features/configuracion/components/CatalogoClavesSATCard.constants";

const estado = vi.hoisted(() => ({
  habilitada: false,
  /** Un handler por cada `Select` montado; el índice 0 es el de tratamiento fiscal. */
  handlers: [] as Array<(v: string) => void>,
}));

vi.mock("@/features/configuracion/hooks/useIvaFrontera", () => ({
  useIvaFronteraHabilitada: () => estado.habilitada,
}));

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  const Ctx = React.createContext<(v: string) => void>(() => {});
  return {
    Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange: (v: string) => void }) => {
      if (!estado.handlers.includes(onValueChange)) estado.handlers.push(onValueChange);
      return <Ctx.Provider value={onValueChange}>{children}</Ctx.Provider>;
    },
    SelectTrigger: ({ children, ...rest }: { children: React.ReactNode }) => (
      <button type="button" {...rest}>{children}</button>
    ),
    SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    SelectValue: () => null,
    SelectItem: ({ children, value, disabled }: { children: React.ReactNode; value: string; disabled?: boolean }) => {
      const cambiar = React.useContext(Ctx);
      return (
        <button
          type="button"
          data-testid={`opcion-${value}`}
          aria-disabled={disabled ? "true" : "false"}
          onClick={() => { if (!disabled) cambiar(value); }}
        >
          {children}
        </button>
      );
    },
  };
});

const draftValido: Draft = { ...EMPTY_DRAFT, patron: "Flete marítimo", clave_sat: "78101800" };

function montar(draft: Draft, tipoIvaOriginal?: Draft["tipo_iva"]) {
  const setDraft = vi.fn();
  const onSave = vi.fn();
  render(
    <table><tbody>
      <EditRow
        draft={draft}
        setDraft={setDraft}
        onCancel={vi.fn()}
        onSave={onSave}
        busy={false}
        valid
        tipoIvaOriginal={tipoIvaOriginal}
      />
    </tbody></table>,
  );
  return { setDraft, onSave };
}

beforeEach(() => {
  estado.habilitada = false;
  estado.handlers = [];
});

describe("EditRow del catálogo y el estímulo del 8%", () => {
  it("alta nueva: la opción de 8% está deshabilitada y no cambia el borrador", () => {
    const { setDraft } = montar(draftValido);
    expect(screen.getByTestId("opcion-gravado_8")).toHaveAttribute("aria-disabled", "true");
    estado.handlers[0]?.("gravado_8");
    expect(setDraft).not.toHaveBeenCalled();
  });

  it("no se puede guardar un borrador al 8% con el estímulo apagado", () => {
    montar({ ...draftValido, tipo_iva: "gravado_8" });
    expect(screen.getByLabelText("Guardar producto")).toBeDisabled();
  });

  it("un producto que ya estaba al 8% conserva su valor y sí se puede guardar", () => {
    montar({ ...draftValido, tipo_iva: "gravado_8" }, "gravado_8");
    expect(screen.getByTestId("opcion-gravado_8")).toHaveAttribute("aria-disabled", "false");
    expect(screen.getByLabelText("Guardar producto")).not.toBeDisabled();
  });

  it("con el estímulo habilitado se puede elegir y guardar el 8%", () => {
    estado.habilitada = true;
    const { setDraft } = montar(draftValido);
    fireEvent.click(screen.getByTestId("opcion-gravado_8"));
    expect(setDraft).toHaveBeenCalledWith(expect.objectContaining({ tipo_iva: "gravado_8" }));
    expect(screen.getByLabelText("Guardar producto")).not.toBeDisabled();
  });

  it("los demás tratamientos se eligen normalmente con el estímulo apagado", () => {
    const { setDraft } = montar(draftValido);
    fireEvent.click(screen.getByTestId("opcion-tasa_0"));
    expect(setDraft).toHaveBeenCalledWith(expect.objectContaining({ tipo_iva: "tasa_0" }));
  });
});
