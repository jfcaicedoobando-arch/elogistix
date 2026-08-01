/** El botón de envío al buzón exige proveedor seleccionado. */
import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

vi.mock("@/features/proveedor/services/duplicadoRfc", () => ({
  findProveedorByRfcEnOrg: vi.fn(async () => null),
}));
vi.mock("@/lib/domain/cfdiXmlMeta", () => ({
  extraerCfdiXmlMetaDeArchivo: vi.fn(async () => null),
  metaCfdiUtil: () => false,
}));

import { useSubirEntranteForm } from "@/features/cxp/hooks/useSubirEntranteForm";

const pdf = () => new File(["x"], "factura.pdf", { type: "application/pdf" });

describe("useSubirEntranteForm — proveedor obligatorio", () => {
  it("no está listo sin proveedor y sí al seleccionarlo", () => {
    const { result } = renderHook(() =>
      useSubirEntranteForm({ organizationId: "org-1" }),
    );

    act(() => result.current.agregarArchivos([pdf()]));
    expect(result.current.listo).toBe(false);

    act(() => result.current.setProveedor({ id: "prov-1", nombre: "Naviera SA" }));
    expect(result.current.listo).toBe(true);
  });
});
