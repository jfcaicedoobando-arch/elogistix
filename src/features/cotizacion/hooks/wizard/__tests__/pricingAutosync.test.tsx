import { render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { expect, it, vi } from "vitest";
import { COTIZACION_FORM_DEFAULTS, type CotizacionFormValues, type FilaCostoLocal } from "@/features/cotizacion/types";
import { useCostosAutoSync } from "../useCostosAutoSync";

const tarifa = { id: "tarifa", flete_base: 1000, naviera_nombre: "Naviera" };
vi.mock("@/features/cotizacion/services/tarifaVinculada", () => ({ fetchTarifaVinculada: async () => tarifa }));
vi.mock("@/features/cotizacion/hooks/useTarifaVinculada", () => ({ useTarifaVinculada: () => ({ data: tarifa }) }));
vi.mock("@/features/costeo/services/topTarifas", () => ({ fetchRecargosDeTarifa: async () => [] }));
vi.mock("@/features/configuracion/hooks/useConfiguracion", () => ({ useConfigValue: () => 0.2 }));
vi.mock("@/features/proveedor/hooks/useProveedores", () => ({ useProveedoresLite: () => ({ data: [] }) }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn() }));

function Costos() {
  const [filas, setFilas] = useState<FilaCostoLocal[]>([]);
  useCostosAutoSync({ filas, setFilas, precargar: true });
  return <output aria-label="Costos">{JSON.stringify(filas)}</output>;
}

function Wizard() {
  const form = useForm<CotizacionFormValues>({
    defaultValues: {
      ...COTIZACION_FORM_DEFAULTS,
      tarifaId: tarifa.id,
      modo: "Marítimo",
      tipoEmbarque: "FCL",
      incoterm: "FOB",
      numContenedores: 3,
    },
  });
  return <FormProvider {...form}><Costos /></FormProvider>;
}

it("precarga el paso 2 con la cantidad y el margen configurado aunque la tarifa venga de Pricing", async () => {
  render(<Wizard />);
  await waitFor(() => expect(JSON.parse(screen.getByLabelText("Costos").textContent ?? "[]")).toEqual([
    expect.objectContaining({ cantidad: 3, costo_unitario: 1000, precio_venta: 1200, costeo_tarifa_id: tarifa.id }),
  ]));
});
