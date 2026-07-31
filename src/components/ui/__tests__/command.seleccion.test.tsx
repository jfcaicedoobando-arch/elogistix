/**
 * Regresión visual del primitivo de comandos: la fila seleccionada del buscador
 * global debe usar la superficie de selección suave (`bg-selection`) y NUNCA el
 * azul sólido (`bg-accent`), porque el texto secundario gris quedaba ilegible.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  Command,
  CommandFooter,
  CommandGroup,
  CommandItem,
  CommandKey,
  CommandList,
} from "@/components/ui/command";

function renderLista() {
  return render(
    <Command>
      <CommandList>
        <CommandGroup heading="Embarques">
          <CommandItem value="elimp00016">
            <span className="font-semibold">ELIMP00016</span>
            <span className="text-muted-foreground">INDIMEX TRADING</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>,
  );
}

describe("CommandItem — fila seleccionada", () => {
  it("la primera fila queda seleccionada con superficie suave, no con azul sólido", () => {
    renderLista();
    const item = screen.getByText("ELIMP00016").closest("[cmdk-item]");
    expect(item).not.toBeNull();
    expect(item).toHaveAttribute("data-selected", "true");
    const clases = item?.className ?? "";
    expect(clases).toContain("data-[selected=true]:bg-selection");
    expect(clases).not.toContain("data-[selected=true]:bg-accent");
    expect(clases).not.toContain("data-[selected=true]:text-accent-foreground");
  });

  it("la fila seleccionada muestra la barra indicadora de acento", () => {
    renderLista();
    const item = screen.getByText("ELIMP00016").closest("[cmdk-item]");
    expect(item?.className).toContain("data-[selected=true]:before:bg-accent");
  });

  it("el texto secundario conserva el gris apagado (no se invierte a blanco)", () => {
    renderLista();
    expect(screen.getByText("INDIMEX TRADING").className).toContain("text-muted-foreground");
  });
});

describe("CommandFooter", () => {
  it("anuncia las teclas de navegar, abrir y cerrar", () => {
    render(
      <CommandFooter>
        <span>
          <CommandKey>↑</CommandKey> navegar
        </span>
        <span>
          <CommandKey>↵</CommandKey> abrir
        </span>
        <span>
          <CommandKey>esc</CommandKey> cerrar
        </span>
      </CommandFooter>,
    );
    expect(screen.getByText("navegar")).toBeInTheDocument();
    expect(screen.getByText("abrir")).toBeInTheDocument();
    expect(screen.getByText("cerrar")).toBeInTheDocument();
  });
});
