import { describe, expect, it, vi } from "vitest";
import { act, render, renderHook, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import type { CotizacionFormValues } from "@/features/cotizacion/types";
vi.mock("../VincularVentasHeredadas", () => ({ VincularVentasHeredadas: () => null }));
vi.mock("@/features/cotizacion/components/SeccionConceptosVentaCotizacion", () => ({ default: () => null }));
vi.mock("@/features/cotizacion/components/SeccionCostosInternosPLUnificado", () => ({ default: () => null }));
vi.mock("@/features/cotizacion/components/PasoResumenCotizacion", () => ({ default: () => null }));
vi.mock("../PasoDatosGenerales", () => ({ default: () => null }));
vi.mock("../Paso1ProgressSidebar", () => ({ default: () => null }));
vi.mock("../TipoCambioCotizacionCard", () => ({ TipoCambioCotizacionCard: ({ monedaCanonica }: { monedaCanonica?: string | null }) => <div data-testid="tc-cotizacion-card">{monedaCanonica ?? "mixta"}</div> }));
import { CotizacionWizardSteps } from "../CotizacionWizardSteps";
import { requiereTipoCambioCotizacion } from "@/features/cotizacion/domain/mezclaMonedas";
type Wizard = Parameters<typeof CotizacionWizardSteps>[0]["w"];
const usd = [{ total: 1.41 }]; const mxn = [{ total: 100 }];

describe("TC visible en una sola divisa extranjera de Pricing", () => {
  it.each([
    [usd, [], "MXN", true], [[], mxn, "USD", true], [usd, [], "USD", false], [[], mxn, "MXN", false],
    [usd, [], null, false], [[], mxn, null, false], [usd, mxn, null, true], [[{ total: 0 }], [], "MXN", false],
  ] as const)("regla para USD=%j MXN=%j objetivo=%s", (usdRows, mxnRows, target, expected) => {
    expect(requiereTipoCambioCotizacion(usdRows, mxnRows, target)).toBe(expected);
  });
  it.each([undefined, 0])("Pricing muestra TC aunque total=%s esté ausente o desactualizado", (total) => {
    expect(requiereTipoCambioCotizacion([{ cantidad: 1, precio_unitario: 1.41, total }], [], "MXN")).toBe(true);
    expect(requiereTipoCambioCotizacion([], [{ cantidad: 1, precio_unitario: 1.41, total }], "USD")).toBe(true);
  });
  it("Pricing admite subtotal legacy y respeta el importe canónico aunque total sea otro", () => {
    expect(requiereTipoCambioCotizacion([{ subtotal: 1.41, total: 0 }], [], "MXN")).toBe(true);
    expect(requiereTipoCambioCotizacion([{ cantidad: 0, precio_unitario: 1.41, total: 100 }], [], "MXN")).toBe(false);
  });
  it("rehidratación muestra TC con USD-only/MXN y reacciona a cambios de identidad", () => {
    const { result } = renderHook(() => useForm<CotizacionFormValues>({ defaultValues: { pricingSolicitudId: "request-A", monedaCrm: "MXN", esProspecto: false } }));
    const form = result.current;
    function Harness() {
      const w = { form, currentStep: 3, conceptosUSD: usd, conceptosMXN: [], costosInternos: [], costosPreLlenados: false, tipoCambioUsd: null, setTipoCambioUsd: vi.fn() } as unknown as Wizard;
      return <CotizacionWizardSteps w={w} clientes={[]} esMaritimo sinDesgloseFlag={false} irACargarCostos={vi.fn()} />;
    }
    render(<Harness />);
    expect(screen.getByTestId("tc-cotizacion-card")).toHaveTextContent("MXN");
    act(() => form.setValue("pricingSolicitudId", null));
    expect(screen.queryByTestId("tc-cotizacion-card")).not.toBeInTheDocument();
    act(() => { form.setValue("pricingSolicitudId", "request-A"); form.setValue("monedaCrm", "USD"); });
    expect(screen.queryByTestId("tc-cotizacion-card")).not.toBeInTheDocument();
    act(() => form.reset({ ...form.getValues(), monedaCrm: "MXN" }));
    expect(screen.getByTestId("tc-cotizacion-card")).toHaveTextContent("MXN");
  });
});
