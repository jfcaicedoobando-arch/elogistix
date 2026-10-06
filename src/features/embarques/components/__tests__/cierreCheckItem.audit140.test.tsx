import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { CierreCheckItem } from "../cierre/CierreCheckItem";

describe("auditoría 140 · aclaración visible del checklist", () => {
  it.each([true, false])("mantiene la explicación de adjuntos con ok=%s", (ok) => {
    render(<MemoryRouter><ul><CierreCheckItem regla="facturas_entrantes_evidencia" ok={ok}
      embarqueId="emb-1" detalle={{ proveedores_sin_evidencia: ok ? 0 : 1, proveedores: ok ? [] : ["Proveedor"] }}
    /></ul></MemoryRouter>);
    expect(screen.getByText("Paso 1 · Cada proveedor tiene archivo recibido o factura vigente registrada")).toBeVisible();
    expect(screen.getByText(/Este control no confirma que haya un PDF o XML adjunto/)).toBeVisible();
    expect(screen.getByText(ok ? "OK" : "Pendiente")).toBeVisible();
    if (ok) expect(screen.queryByRole("link")).toBeNull();
    else expect(screen.getByRole("link")).toHaveAttribute("href", expect.stringContaining("focus=facturas-entrantes"));
  });
});
