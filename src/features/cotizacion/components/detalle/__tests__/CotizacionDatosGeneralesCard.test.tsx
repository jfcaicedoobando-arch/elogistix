import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CotizacionDatosGeneralesCard } from "../CotizacionDatosGeneralesCard";

const cotizacion = {
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  origen: "Shanghái",
  destino: "Manzanillo",
  vigencia_dias: 1,
  fecha_vigencia: "2026-09-10",
  tiempo_transito_dias: 2,
  tipo_embarque: "FCL",
  dias_libres_destino: 1,
  dias_almacenaje: 0,
};

describe("CotizacionDatosGeneralesCard", () => {
  it("pluraliza vigencia y contadores de días visibles", () => {
    render(<CotizacionDatosGeneralesCard cotizacion={cotizacion} />);

    expect(screen.getByText("1 día (hasta 10/09/2026)")).toBeInTheDocument();
    expect(screen.getByText("2 días")).toBeInTheDocument();
    expect(screen.getByText("1 día")).toBeInTheDocument();
    expect(screen.queryByText(/1 días/)).not.toBeInTheDocument();
  });

  it("permite dos líneas en origen y destino sin truncar los demás campos", () => {
    render(<CotizacionDatosGeneralesCard cotizacion={{
      ...cotizacion,
      origen: "Busan, Corea del Sur (KRPUS)",
      destino: "Parque Industrial Apodaca, Nuevo León, México",
    }} />);
    expect(screen.getByText(/Busan, Corea/)).toHaveClass("line-clamp-2", "break-words");
    expect(screen.getByText(/Parque Industrial Apodaca/)).toHaveClass("line-clamp-2", "break-words");
    expect(screen.getByText("FOB")).toHaveClass("truncate");
  });
});