import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { Hint } from "../Hint";

describe("Hint", () => {
  it("renderiza el hijo tal cual cuando no hay label", () => {
    render(
      <Hint>
        <button type="button">Guardar</button>
      </Hint>,
    );
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("no agrega atributo title nativo al disparador", () => {
    render(
      <Hint label="Descargar PDF">
        <button type="button" aria-label="Descargar PDF">
          PDF
        </button>
      </Hint>,
    );
    const boton = screen.getByRole("button", { name: "Descargar PDF" });
    expect(boton).not.toHaveAttribute("title");
  });
});
