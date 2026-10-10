import { render, screen } from "@testing-library/react";
import { FormProvider, useForm } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TarifaVinculadaPanel from "../TarifaVinculadaPanel";
import { COTIZACION_FORM_DEFAULTS, type CotizacionFormValues } from "@/features/cotizacion/types";

// Aísla el barrel de UI; la normalización importada sigue siendo la real.
vi.mock("@/features/catalogos", async () => {
  const { claveIdentidadCatalogo } = await import("@/features/catalogos/utils/tiposContenedorCanonico");
  return { claveIdentidadCatalogo };
});

const HC = "11111111-1111-4111-8111-111111111111";
const LEGACY = "22222222-2222-4222-8222-222222222222";
const catalogo = [
  { id: HC, code: "40HC", name: "40' High Cube", idsEquivalentes: [HC, LEGACY] },
  { id: "dry", code: "20DRY", name: "20' Dry", idsEquivalentes: ["dry"] },
];
const { leerTipos } = vi.hoisted(() => ({ leerTipos: vi.fn() }));
vi.mock("@/features/catalogos/hooks", () => ({ useTiposContenedor: () => leerTipos() }));
vi.mock("@/features/cotizacion/hooks/useTarifaVinculada", () => ({
  useTarifaVinculada: () => ({ data: { tipo_contenedor_id: "22222222-2222-4222-8222-222222222222", tipo_contenedor_nombre: "40' High Cube" } }),
}));
vi.mock("@/features/costeo", () => ({ destinoDe: vi.fn(), origenDe: vi.fn(), etiquetaRutaCompleta: () => "Ningbo → Manzanillo" }));
vi.mock("@/features/costeo/components/BuscarTarifaDialog", () => ({ BuscarTarifaDialog: () => null }));
vi.mock("../TarifaResumenHeredado", () => ({ default: () => null }));
vi.mock("../seccionRuta/SugerenciasTarifaInline", () => ({ default: () => null }));
vi.mock("../seccionRuta/rutaPuertoHandlers", () => ({ desvincularTarifa: vi.fn() }));
vi.mock("../seccionRuta/aplicarTarifa", () => ({ aplicarTarifaAlForm: vi.fn() }));

function Fixture({ valor }: { valor: string }) {
  const form = useForm<CotizacionFormValues>({ defaultValues: {
    ...COTIZACION_FORM_DEFAULTS, modo: "Marítimo", tarifaId: "t1", tipoContenedor: valor,
  } });
  return <FormProvider {...form}><TarifaVinculadaPanel /></FormProvider>;
}

beforeEach(() => leerTipos.mockReturnValue({ data: catalogo }));

describe("GUI69: aviso visible del panel", () => {
  it.each([HC, LEGACY, "40' High Cube", "40HC"])("no muestra aviso falso para %s", (valor) => {
    render(<Fixture valor={valor} />);
    expect(screen.queryByText(/El tipo de contenedor del Paso 1 difiere/)).not.toBeInTheDocument();
  });

  it.each(["20' Dry", "Contenedor no catalogado"])("muestra la discrepancia de %s", (valor) => {
    render(<Fixture valor={valor} />);
    expect(screen.getByText(/El tipo de contenedor del Paso 1 difiere/)).toBeInTheDocument();
  });

  it("espera el catálogo sin dibujar un falso desacuerdo", () => {
    leerTipos.mockReturnValue({ data: [], isLoading: true });
    const { rerender } = render(<Fixture valor="40' High Cube" />);
    expect(screen.queryByText(/El tipo de contenedor del Paso 1 difiere/)).not.toBeInTheDocument();
    leerTipos.mockReturnValue({ data: catalogo });
    rerender(<Fixture valor="40' High Cube" />);
    expect(screen.queryByText(/El tipo de contenedor del Paso 1 difiere/)).not.toBeInTheDocument();
  });

  it.each([{ data: [], isLoading: false }, { isError: true, isLoading: false }])(
    "avisa si el catálogo quedó vacío o falló, sin afirmar incompatibilidad", (estado) => {
      leerTipos.mockReturnValue(estado);
      render(<Fixture valor="40' High Cube" />);
      expect(screen.getByText(/No se pudo comprobar el tipo de contenedor/)).toBeInTheDocument();
      expect(screen.queryByText(/El tipo de contenedor del Paso 1 difiere/)).not.toBeInTheDocument();
    },
  );
});
