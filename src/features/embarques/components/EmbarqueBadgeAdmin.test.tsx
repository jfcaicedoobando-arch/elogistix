import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { EmbarqueBadgeAdmin } from "./EmbarqueBadgeAdmin";

const resumen = vi.hoisted(() => ({ pendientes: 0, cxc_pendiente: 0, cxp_pendiente: 0, venta_no_facturada: 0, docs_faltantes: 0 }));
vi.mock("@/features/embarques/hooks/useAdminPendienteResumen", () => ({
  useAdminPendienteResumen: () => ({ data: resumen, isLoading: false }),
}));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
  TooltipContent: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));
vi.mock("@/components/ui/badge", () => ({ Badge: ({ children }: React.PropsWithChildren) => <span>{children}</span> }));

describe("EmbarqueBadgeAdmin", () => {
  it("un resumen vacío invita al diagnóstico sin prometer cierre", () => {
    resumen.pendientes = 0;
    const html = renderToStaticMarkup(<EmbarqueBadgeAdmin embarqueId="e1" estado="Entregado" />);
    expect(html).toContain("Sin pendientes en el resumen. Revisar cierre");
    expect(html).toContain("Revisa el diagnóstico de cierre");
    expect(html).not.toContain("Listo para cerrar");
  });
  it("mantiene el indicador de pendientes cuando existen", () => {
    resumen.pendientes = 1;
    const html = renderToStaticMarkup(<EmbarqueBadgeAdmin embarqueId="e1" estado="Entregado" />);
    expect(html).toContain("Admin pendiente");
    expect(html).not.toContain("Sin pendientes en el resumen");
  });
});
