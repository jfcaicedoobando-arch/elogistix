import { describe, expect, it } from "vitest";
import { renderBootstrapFallback } from "../renderBootstrapFallback";

function crearRoot(): HTMLElement {
  const root = document.createElement("div");
  root.id = "root";
  document.body.append(root);
  return root;
}

describe("renderBootstrapFallback", () => {
  it("pinta la pantalla de recuperación en es-MX con el detalle del error", () => {
    const root = crearRoot();

    expect(renderBootstrapFallback(new Error("boom de arranque"), root)).toBe(true);
    expect(root.textContent).toContain("No pudimos iniciar la aplicación");
    expect(root.textContent).toContain("boom de arranque");
    expect(root.querySelector("button")?.textContent).toBe("Recargar");
  });

  it("usa tokens semánticos y nunca colores literales", () => {
    const root = crearRoot();
    renderBootstrapFallback("falla", root);

    const html = root.outerHTML;
    expect(html).toContain("bg-background");
    expect(html).toContain("text-muted-foreground");
    expect(html).not.toMatch(/text-white|bg-black|#[0-9a-fA-F]{6}/);
  });

  it("tolera errores no-Error y la ausencia de contenedor", () => {
    const root = crearRoot();
    renderBootstrapFallback({ raro: true }, root);
    expect(root.textContent).toContain("Error desconocido durante el arranque.");

    expect(renderBootstrapFallback(new Error("x"), null)).toBe(false);
  });

  it("reemplaza el contenido previo del contenedor", () => {
    const root = crearRoot();
    root.innerHTML = "<span>viejo</span>";
    renderBootstrapFallback(new Error("nuevo"), root);
    expect(root.textContent).not.toContain("viejo");
  });
});
