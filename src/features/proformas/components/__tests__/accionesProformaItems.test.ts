import { describe, expect, it, vi } from "vitest";
import { buildPrimaryItem, buildSecondaryItems } from "../accionesProformaItems";

const noop = () => undefined;

describe("acciones de proforma para cliente de casa (V-11)", () => {
  it("promueve aprobar internamente a CTA primaria cuando está pendiente", () => {
    const onAprobarInterna = vi.fn();
    const item = buildPrimaryItem({
      puedeConvertir: false,
      puedeAprobarInterna: true,
      convirtiendo: false,
      aprobando: true,
      onConvertir: noop,
      onAprobarInterna,
    });
    expect(item?.id).toBe("aprobar-interna");
    expect(item?.label).toBe("Aprobar internamente");
    expect(item?.loading).toBe(true);
    item?.onClick?.();
    expect(onAprobarInterna).toHaveBeenCalledOnce();
  });

  it("conserva convertir a factura como CTA cuando ya está aceptada", () => {
    const item = buildPrimaryItem({
      puedeConvertir: true,
      puedeAprobarInterna: false,
      convirtiendo: false,
      aprobando: false,
      onConvertir: noop,
      onAprobarInterna: noop,
    });
    expect(item?.id).toBe("convertir");
  });

  it("mantiene envío como acción secundaria marcada opcional", () => {
    const items = buildSecondaryItems({
      facturada: false,
      cargando: false,
      puedeAprobarInterna: true,
      puedeResponder: false,
      puedeEnviar: true,
      onDescargar: noop,
      onEnviar: noop,
      onAceptarManual: noop,
      onRechazarManual: noop,
    });
    expect(items.map((item) => item.label)).toEqual(["Descargar PDF", "Enviar al cliente (opcional)"]);
    expect(items.some((item) => item.id === "aprobar-interna")).toBe(false);
  });
});
