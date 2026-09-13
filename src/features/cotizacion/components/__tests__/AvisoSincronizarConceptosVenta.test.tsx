/**
 * v13.823.360 — El aviso de sincronización llama `useUpdateCotizacion`, que
 * exige SALES (canWriteCotizaciones). Contabilidad/tesorería veían el botón
 * "Sincronizar conceptos de venta desde costos" y recibían 42501 al pulsarlo.
 * Sin la capacidad de escritura el aviso se muestra como texto de sólo
 * lectura (sin botón).
 *
 * v13.823.362 — En Aceptada/En operación el trigger `cotizaciones_guard_en_operacion`
 * rechaza el UPDATE de conceptos_venta/subtotal/moneda (LC_COTIZACION_INMUTABLE).
 * El aviso recibe el estado y oculta el botón, ofreciendo guía para crear una
 * nueva versión o Re-cotizar.
 *
 * NO ejecutado en Lovable; corre en GitHub Actions con el resto de la suite.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/features/cotizacion/hooks", () => ({
  useUpdateCotizacion: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));

import { AvisoSincronizarConceptosVenta } from "../AvisoSincronizarConceptosVenta";
import type { CostoCotizacion } from "@/features/cotizacion/types";
import type { EstadoCotizacion } from "@/features/cotizacion/services/mutations/estado";

const costos = [
  {
    id: "c1", cotizacion_id: "cot-1", concepto: "Flete", moneda: "MXN",
    proveedor: "ACME", cantidad: 1, costo_unitario: 500, costo_total: 500,
    precio_venta: 700, unidad_medida: "contenedor", notas: null,
    costeo_tarifa_id: null, costeo_tarifa_recargo_id: null,
    created_at: "", updated_at: "",
  } as unknown as CostoCotizacion,
];

function renderAviso(puedeSincronizar: boolean, estado: EstadoCotizacion = "Borrador") {
  return render(
    <AvisoSincronizarConceptosVenta
      cotizacionId="cot-1"
      costos={costos}
      tasaIva={0.16}
      visible
      puedeSincronizar={puedeSincronizar}
      estadoCotizacion={estado}
    />,
  );
}

describe("AvisoSincronizarConceptosVenta — matriz de permiso", () => {
  it("con escritura (ventas/operación) muestra el botón de sincronizar", () => {
    renderAviso(true);
    expect(screen.getByRole("button", { name: /Sincronizar conceptos de venta desde costos/i })).toBeInTheDocument();
  });

  it("sin escritura (contabilidad/tesorería) oculta el botón y deja texto de sólo lectura", () => {
    renderAviso(false);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText(/Un usuario de ventas u operación debe regenerar los conceptos/i)).toBeInTheDocument();
    expect(screen.getByTestId("aviso-sincronizar-venta")).toBeInTheDocument();
  });

  it("sin escritura no menciona la acción al lector", () => {
    renderAviso(false);
    expect(screen.queryByText(/Puedes regenerar los conceptos/i)).toBeNull();
  });

  it("visible=false no renderiza nada", () => {
    const { container } = render(
      <AvisoSincronizarConceptosVenta
        cotizacionId="cot-1" costos={costos} tasaIva={0.16} visible={false} puedeSincronizar estadoCotizacion="Borrador"
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("AvisoSincronizarConceptosVenta — estados inmutables", () => {
  it.each<EstadoCotizacion>(["Aceptada", "En operación"])(
    "en estado %s oculta el botón aunque el usuario tenga escritura",
    (estado) => {
      renderAviso(true, estado);
      expect(screen.queryByRole("button")).toBeNull();
      expect(screen.getByText(/crea una nueva versión o usa Re-cotizar/i)).toBeInTheDocument();
    },
  );

  it("en Borrador/Enviada/Solicitada el botón sigue disponible con escritura", () => {
    renderAviso(true, "Enviada");
    expect(screen.getByRole("button", { name: /Sincronizar conceptos de venta desde costos/i })).toBeInTheDocument();
  });
});
